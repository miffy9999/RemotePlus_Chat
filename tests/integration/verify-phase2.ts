import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";

const api = process.env.API_URL ?? "http://127.0.0.1:4000/api";
const socketUrl = process.env.SOCKET_URL ?? "http://127.0.0.1:4000/chat";

/** JSON REST 요청의 오류 응답까지 포함해 Phase 2 검증 실패 원인을 명확하게 표시합니다. */
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} 실패(${response.status}): ${JSON.stringify(body)}`);
  return body;
}

/** Socket.IO 이벤트가 제한 시간 안에 오지 않으면 테스트를 실패시켜 누락을 숨기지 않습니다. */
function once(socket: Socket, event: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} 이벤트 대기 시간 초과`)), timeoutMs);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

/** 연결 후 서버의 chat:join 승인 응답까지 확인합니다. */
async function connectAndJoin(auth: Record<string, string>, sessionId: string): Promise<Socket> {
  const socket = io(socketUrl, { auth, reconnection: false, transports: ["websocket"] });
  await once(socket, "connect");
  const result = await socket.emitWithAck("chat:join", { sessionId });
  if (!result?.ok) throw new Error(`채팅방 입장 실패: ${JSON.stringify(result)}`);
  return socket;
}

/** 짧은 관찰 구간 동안 특정 이벤트가 오지 않아야 채팅방 격리가 성공한 것으로 판단합니다. */
async function expectNoEvent(socket: Socket, event: string, observationMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    let received = false;
    const listener = () => { received = true; };
    socket.on(event, listener);
    setTimeout(() => { socket.off(event, listener); resolve(!received); }, observationMs);
  });
}

async function main(): Promise<void> {
  const admin = await request("/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId: "admin", password: "Admin1234!" }) });
  const adminHeaders = { authorization: `Bearer ${admin.accessToken}` };

  // 이전 수동 검증에서 남은 쓰기 가능 상담을 닫아 동일 룸 중복 제한이 이번 테스트를 방해하지 않게 합니다.
  const sessions = await request("/agent/chat-sessions", { headers: adminHeaders });
  for (const session of sessions.filter((item: any) => ["WAITING", "ACTIVE"].includes(item.status))) {
    await request(`/chat-sessions/${session.id}/close`, { method: "POST", headers: adminHeaders });
  }

  const verified = await request("/guest/access/verify", { method: "POST", body: JSON.stringify({ accessKey: "demo-room-access-1201" }) });
  const created = await request("/chat-sessions", { method: "POST", headers: { authorization: `Bearer ${verified.accessToken}` }, body: JSON.stringify({ language: "ko" }) });
  const sessionId = created.session.id as string;
  const secondVerified = await request("/guest/access/verify", { method: "POST", body: JSON.stringify({ accessKey: "demo-room-access-1202" }) });
  const secondCreated = await request("/chat-sessions", { method: "POST", headers: { authorization: `Bearer ${secondVerified.accessToken}` }, body: JSON.stringify({ language: "ko" }) });
  const secondSessionId = secondCreated.session.id as string;
  const agent = await request("/auth/agent/login", { method: "POST", body: JSON.stringify({ loginId: "agent01", password: "Agent1234!" }) });
  const agentHeaders = { authorization: `Bearer ${agent.accessToken}` };

  const guestSocket = await connectAndJoin({ guestToken: created.guestToken, sessionId }, sessionId);
  const updatedPromise = once(guestSocket, "chat:session-updated");
  await request(`/agent/chat-sessions/${sessionId}/accept`, { method: "POST", headers: agentHeaders });
  const updated = await updatedPromise;
  const agentSocket = await connectAndJoin({ staffToken: agent.accessToken }, sessionId);
  await request(`/agent/chat-sessions/${secondSessionId}/accept`, { method: "POST", headers: agentHeaders });
  const secondGuestSocket = await connectAndJoin({ guestToken: secondCreated.guestToken, sessionId: secondSessionId }, secondSessionId);

  const clientMessageId = randomUUID();
  const agentReceivePromise = once(agentSocket, "chat:message");
  const guestAcceptedPromise = once(guestSocket, "chat:message-accepted");
  const isolationPromise = expectNoEvent(secondGuestSocket, "chat:message");
  const firstAck = await guestSocket.emitWithAck("chat:message", { sessionId, clientMessageId, content: "수건을 추가로 부탁드립니다." });
  const guestAccepted = await guestAcceptedPromise;
  const agentReceived = await agentReceivePromise;
  const isolated = await isolationPromise;

  // 같은 clientMessageId 재전송은 기존 메시지 승인만 돌려주고 상대방에게 두 번 전달하지 않습니다.
  const duplicateAck = await guestSocket.emitWithAck("chat:message", { sessionId, clientMessageId, content: "수건을 추가로 부탁드립니다." });
  const guestReceivePromise = once(guestSocket, "chat:message");
  await agentSocket.emitWithAck("chat:message", { sessionId, clientMessageId: randomUUID(), content: "곧 전달해 드리겠습니다." });
  const guestReceived = await guestReceivePromise;

  const history = await request(`/chat-sessions/${sessionId}/messages`, { headers: { "x-guest-token": created.guestToken } });

  // 연결을 새로 만든 뒤 REST 이력으로 동일한 두 메시지를 복구할 수 있어야 합니다.
  guestSocket.disconnect();
  const reconnectedGuest = await connectAndJoin({ guestToken: created.guestToken, sessionId }, sessionId);
  const recovered = await request(`/chat-sessions/${sessionId}/messages`, { headers: { "x-guest-token": created.guestToken } });

  const guestClosedPromise = once(reconnectedGuest, "chat:session-closed");
  const agentClosedPromise = once(agentSocket, "chat:session-closed");
  await request(`/chat-sessions/${sessionId}/close`, { method: "POST", headers: agentHeaders });
  const [guestClosed, agentClosed] = await Promise.all([guestClosedPromise, agentClosedPromise]);
  await request(`/chat-sessions/${secondSessionId}/close`, { method: "POST", headers: agentHeaders });

  // 인증 정보가 전혀 없는 연결은 connect 이벤트 전에 서버 미들웨어에서 거절되어야 합니다.
  const unauthorizedSocket = io(socketUrl, { reconnection: false, transports: ["websocket"] });
  const connectionError = await once(unauthorizedSocket, "connect_error");

  reconnectedGuest.disconnect();
  agentSocket.disconnect();
  secondGuestSocket.disconnect();
  unauthorizedSocket.disconnect();

  const result = {
    sessionUpdated: updated.status === "ACTIVE",
    senderAcceptedAfterSave: firstAck.ok === true && guestAccepted.id === agentReceived.id,
    roomMessageDelivered: agentReceived.content === "수건을 추가로 부탁드립니다.",
    roomIsolated: isolated,
    duplicatePrevented: duplicateAck.duplicate === true,
    reverseMessageDelivered: guestReceived.content === "곧 전달해 드리겠습니다.",
    historyStored: history.length === 2,
    reconnectRecovered: recovered.length === 2,
    closeBroadcast: guestClosed.status === "CLOSED" && agentClosed.status === "CLOSED",
    unauthorizedBlocked: connectionError?.data?.code === "UNAUTHORIZED",
  };
  if (Object.values(result).includes(false)) throw new Error(`Phase 2 검증 실패: ${JSON.stringify(result)}`);
  console.log(JSON.stringify(result));
}

void main();
