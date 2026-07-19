import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { acceptSession, closeSession, createAdminAgent, createHotel, createRoom, getMessages, listAdminAgents, listHotels, listRooms, listSessions, login, loginAdmin, type AdminAgentView, type HotelView, type MessageView, type RoomView, type SessionView, SOCKET_URL } from "./api";
import "./styles.css";

interface AgentAuth { accessToken: string; agent: { id: string; name: string; role: "AGENT" | "ADMIN" } }

/** 새 메시지와 새 상담을 ID 기준으로 병합해 재연결·중복 이벤트에도 화면 중복을 방지합니다. */
function mergeMessage(items: MessageView[], incoming: MessageView): MessageView[] {
  return items.some((item) => item.id === incoming.id) ? items : [...items, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 서버 만료 시각을 기준으로 화면에 표시할 MM:SS 문자열을 계산합니다. */
function remainingTime(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Agent 인증 정보는 탭 종료 시 제거되는 sessionStorage에만 보관합니다. */
function readAuth(): AgentAuth | null {
  try { return JSON.parse(sessionStorage.getItem("hotel-chat-agent-auth") ?? "null") as AgentAuth | null; } catch { return null; }
}

/** 실제 Agent API를 호출하는 로그인 화면입니다. */
function LoginPage({ onLogin }: { onLogin: (auth: AgentAuth) => void }): React.JSX.Element {
  const [loginId, setLoginId] = useState("agent01");
  const [password, setPassword] = useState("Agent1234!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault(); setLoading(true); setError("");
    try { const auth = await login(loginId, password); sessionStorage.setItem("hotel-chat-agent-auth", JSON.stringify(auth)); onLogin(auth); navigate("/agent"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "로그인에 실패했습니다."); }
    finally { setLoading(false); }
  }

  return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand dark">REMOTE<span>+</span></div><h1>Agent 로그인</h1><p>상담 센터 계정으로 로그인하세요.</p><label>로그인 ID<input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" /></label><label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>{error && <div className="error-box">{error}</div>}<button disabled={loading}>{loading ? "로그인 중…" : "로그인"}</button><small>개발용 계정은 `.env.example`에서 확인할 수 있습니다.</small></form></div>;
}

/** 선택한 상담에 Socket.IO로 연결하고 메시지 이력·전송·종료를 처리합니다. */
function AgentChat({ auth, initial, onBack, onChanged }: { auth: AgentAuth; initial: SessionView; onBack: () => void; onChanged: () => void }): React.JSX.Element {
  const [session, setSession] = useState(initial);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState("연결 중");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    getMessages(auth.accessToken, session.id).then((history) => active && setMessages(history)).catch((reason) => active && setError(reason.message));
    const socket = io(SOCKET_URL, { auth: { staffToken: auth.accessToken }, transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", async () => { setConnection("연결됨"); const joined = await socket.emitWithAck("chat:join", { sessionId: session.id }); if (!joined?.ok) setError(joined?.error?.message ?? "상담방 입장에 실패했습니다."); });
    socket.on("disconnect", () => setConnection("연결 끊김"));
    socket.io.on("reconnect_attempt", () => setConnection("재연결 중"));
    socket.on("chat:message", (message: MessageView) => setMessages((items) => mergeMessage(items, message)));
    socket.on("chat:message-accepted", (message: MessageView) => setMessages((items) => mergeMessage(items, message)));
    socket.on("chat:session-closed", (updated: SessionView) => { if (updated.id === session.id) { setSession(updated); onChanged(); } });
    socket.on("chat:error", (payload: { message: string }) => setError(payload.message));
    return () => { active = false; socket.disconnect(); socketRef.current = null; };
  }, [auth.accessToken, session.id]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault(); const content = input.trim(); if (!content || !socketRef.current || session.status !== "ACTIVE") return;
    setInput(""); const result = await socketRef.current.emitWithAck("chat:message", { sessionId: session.id, clientMessageId: crypto.randomUUID(), content });
    if (!result?.ok) setError(result?.error?.message ?? "메시지 전송에 실패했습니다.");
  }

  /** 브라우저 기본 확인창 대신 화면 안의 확인창을 사용해 모바일과 자동화 환경에서도 같은 흐름을 제공합니다. */
  async function close(): Promise<void> { try { setSession(await closeSession(auth.accessToken, session.id)); setShowCloseConfirm(false); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : "종료에 실패했습니다."); } }

  return <Page auth={auth} title={`${session.room.roomNumber}호 상담`} subtitle={`${session.room.hotel.name} · ${session.language.toUpperCase()}`}><div className="chat-card"><div className="chat-toolbar"><button className="secondary" onClick={onBack}>← 목록</button><div><span className={`connection ${connection === "연결됨" ? "ok" : ""}`}>● {connection}</span><strong>{session.status === "ACTIVE" ? remainingTime(session.expiresAt, now) : "종료"}</strong><button className="danger" onClick={() => setShowCloseConfirm(true)} disabled={session.status !== "ACTIVE"}>상담 종료</button></div></div>{error && <div className="error-box">{error}</div>}<div className="chat-messages">{messages.length === 0 && <div className="empty">아직 메시지가 없습니다.</div>}{messages.map((message) => <div key={message.id} className={`bubble ${message.senderType === "AGENT" ? "mine" : "theirs"}`}><small>{message.senderType === "AGENT" ? "나" : "투숙객"} · {new Date(message.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small><p>{message.content}</p></div>)}</div><form className="chat-composer" onSubmit={send}><input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder={session.status === "ACTIVE" ? "메시지를 입력하세요" : "종료된 상담입니다"} disabled={session.status !== "ACTIVE"}/><button disabled={!input.trim() || session.status !== "ACTIVE"}>전송</button></form></div>{showCloseConfirm && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-title"><h2 id="close-title">상담을 종료할까요?</h2><p>종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.</p><div><button className="secondary" onClick={() => setShowCloseConfirm(false)}>취소</button><button className="danger" onClick={() => void close()}>상담 종료</button></div></section></div>}</Page>;
}

/** 상담 목록은 서버 데이터를 주기적으로 새로 받아 대기·진행·종료 상태를 보여줍니다. */
function AgentPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const previousWaiting = useRef(0);

  async function refresh(): Promise<void> {
    try { const data = await listSessions(auth.accessToken); const waiting = data.filter((item) => item.status === "WAITING").length; if (previousWaiting.current && waiting > previousWaiting.current) playNotificationSound(); previousWaiting.current = waiting; setSessions(data); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "상담 목록을 불러오지 못했습니다."); }
  }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, []);

  const waiting = useMemo(() => sessions.filter((item) => item.status === "WAITING"), [sessions]);
  const active = useMemo(() => sessions.filter((item) => item.status === "ACTIVE" && item.agentId === auth.agent.id), [sessions, auth.agent.id]);
  const closed = useMemo(() => sessions.filter((item) => ["CLOSED", "EXPIRED"].includes(item.status) && item.agentId === auth.agent.id), [sessions, auth.agent.id]);
  if (selected) return <AgentChat auth={auth} initial={selected} onBack={() => { setSelected(null); void refresh(); }} onChanged={() => void refresh()} />;

  async function accept(session: SessionView): Promise<void> { try { setSelected(await acceptSession(auth.accessToken, session.id)); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "상담 수락에 실패했습니다."); await refresh(); } }

  return <Page auth={auth} title="Agent 상담 센터" subtitle="대기 중인 상담을 확인하고 응답합니다."><div className="stats"><article><span>대기</span><strong>{waiting.length}</strong></article><article><span>내 진행</span><strong>{active.length}</strong></article><article><span>내 종료</span><strong>{closed.length}</strong></article></div>{error && <div className="error-box">{error}</div>}<section className="card"><div className="section-head"><div><h2>대기 상담</h2><p>오래 기다린 상담부터 확인하세요.</p></div><button onClick={() => void refresh()}>새로고침</button></div><SessionTable items={waiting} action={(session) => <button onClick={() => void accept(session)}>상담 수락</button>} /></section><section className="card"><div className="section-head"><div><h2>내 진행 상담</h2><p>현재 담당 중인 상담입니다.</p></div></div><SessionTable items={active} action={(session) => <button onClick={() => setSelected(session)}>상담 열기</button>} /></section><section className="card"><div className="section-head"><div><h2>종료 상담</h2><p>최근 종료되거나 만료된 내 상담입니다.</p></div></div><SessionTable items={closed.slice(0, 10)} action={(session) => <button onClick={() => setSelected(session)}>기록 보기</button>} /></section></Page>;
}

/** 상담 목록의 공통 열을 한 컴포넌트로 관리해 상태별 표가 서로 달라지지 않게 합니다. */
function SessionTable({ items, action }: { items: SessionView[]; action: (session: SessionView) => React.ReactNode }): React.JSX.Element {
  // 작은 화면에서는 표 전체를 가로 스크롤할 수 있게 감싸 상담 정보 열이 찌그러지지 않도록 합니다.
  return <div className="table-wrap"><table><thead><tr><th>호텔</th><th>객실</th><th>언어</th><th>상태</th><th>만료 시각</th><th>작업</th></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={6} className="empty">표시할 상담이 없습니다.</td></tr> : items.map((session) => <tr key={session.id}><td>{session.room.hotel.name}</td><td>{session.room.roomNumber}</td><td>{session.language.toUpperCase()}</td><td><span className={`badge ${session.status.toLowerCase()}`}>{session.status}</span></td><td>{new Date(session.expiresAt).toLocaleTimeString("ko-KR")}</td><td>{action(session)}</td></tr>)}</tbody></table></div>;
}

/** 브라우저 정책으로 소리가 차단될 수 있으므로 실패해도 화면 동작은 계속합니다. */
function playNotificationSound(): void { try { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.frequency.value = 880; oscillator.start(); oscillator.stop(context.currentTime + 0.12); } catch { /* 화면 강조가 기본 알림 수단입니다. */ } }

/** 기존 관리자 화면은 Phase 3A 전까지 QR 비활성 원칙을 보여주는 정적 화면으로 유지합니다. */
/** 관리자 전용 로그인은 Agent 토큰과 다른 저장 키를 사용해 역할 화면이 섞이지 않게 합니다. */
function AdminLogin({ onLogin }: { onLogin: (auth: AgentAuth) => void }): React.JSX.Element { const [loginId,setLoginId]=useState("admin"); const [password,setPassword]=useState("Admin1234!"); const [error,setError]=useState(""); async function submit(e:FormEvent){e.preventDefault();try{const value=await loginAdmin(loginId,password);sessionStorage.setItem("hotel-chat-admin-auth",JSON.stringify(value));onLogin(value);}catch(reason){setError(reason instanceof Error?reason.message:"로그인에 실패했습니다.");}} return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand dark">REMOTE<span>+</span></div><h1>관리자 로그인</h1><label>로그인 ID<input value={loginId} onChange={e=>setLoginId(e.target.value)}/></label><label>비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="error-box">{error}</div>}<button>로그인</button></form></div>; }

/** 관리자 MVP는 Agent·호텔·룸 CRUD를 실제 API로 제공하며 QR 칸은 후속 확장 자리만 둡니다. */
function AdminPage({auth}:{auth:AgentAuth}):React.JSX.Element { const [agents,setAgents]=useState<AdminAgentView[]>([]),[hotels,setHotels]=useState<HotelView[]>([]),[rooms,setRooms]=useState<RoomView[]>([]),[filter,setFilter]=useState(""),[error,setError]=useState(""); const [agentForm,setAgentForm]=useState({name:"",loginId:"",password:""}),[hotelName,setHotelName]=useState(""),[roomNumber,setRoomNumber]=useState(""),[roomHotelId,setRoomHotelId]=useState(""); async function refresh(){try{const [a,h,r]=await Promise.all([listAdminAgents(auth.accessToken),listHotels(auth.accessToken),listRooms(auth.accessToken,filter||undefined)]);setAgents(a);setHotels(h);setRooms(r);if(!roomHotelId&&h[0])setRoomHotelId(h[0].id);setError("");}catch(reason){setError(reason instanceof Error?reason.message:"관리 데이터를 불러오지 못했습니다.");}} useEffect(()=>{void refresh();},[filter]); async function addAgent(e:FormEvent){e.preventDefault();try{await createAdminAgent(auth.accessToken,agentForm);setAgentForm({name:"",loginId:"",password:""});await refresh();}catch(r){setError(r instanceof Error?r.message:"Agent 추가 실패");}} async function addHotel(e:FormEvent){e.preventDefault();try{await createHotel(auth.accessToken,hotelName);setHotelName("");await refresh();}catch(r){setError(r instanceof Error?r.message:"호텔 추가 실패");}} async function addRoom(e:FormEvent){e.preventDefault();try{await createRoom(auth.accessToken,roomHotelId,roomNumber);setRoomNumber("");await refresh();}catch(r){setError(r instanceof Error?r.message:"룸 추가 실패");}} function logout(){sessionStorage.removeItem("hotel-chat-admin-auth");location.href="/admin/login";} return <div className="admin-shell"><header><div><div className="brand dark">REMOTE<span>+</span></div><h1>관리자 페이지</h1></div><button className="secondary" onClick={logout}>로그아웃</button></header>{error&&<div className="error-box">{error}</div>}<section className="card"><h2>Agent 관리</h2><form className="inline-form" onSubmit={addAgent}><input aria-label="Agent 이름" placeholder="이름" value={agentForm.name} onChange={e=>setAgentForm({...agentForm,name:e.target.value})}/><input aria-label="Agent 로그인 ID" placeholder="로그인 ID" value={agentForm.loginId} onChange={e=>setAgentForm({...agentForm,loginId:e.target.value})}/><input aria-label="Agent 비밀번호" type="password" placeholder="영문+숫자 8자 이상" value={agentForm.password} onChange={e=>setAgentForm({...agentForm,password:e.target.value})}/><button>Agent 추가</button></form><table><thead><tr><th>이름</th><th>ID</th><th>상태</th></tr></thead><tbody>{agents.map(a=><tr key={a.id}><td>{a.name}</td><td>{a.loginId}</td><td>{a.status}</td></tr>)}</tbody></table></section><section className="card"><h2>호텔·룸 관리</h2><form className="inline-form" onSubmit={addHotel}><input aria-label="호텔 이름" placeholder="호텔 이름" value={hotelName} onChange={e=>setHotelName(e.target.value)}/><button>호텔 추가</button></form><form className="inline-form" onSubmit={addRoom}><select aria-label="룸을 추가할 호텔" value={roomHotelId} onChange={e=>setRoomHotelId(e.target.value)}>{hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select><input aria-label="객실 번호" placeholder="객실 번호" value={roomNumber} onChange={e=>setRoomNumber(e.target.value)}/><button>룸 추가</button></form><label className="filter">호텔 필터<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">전체 호텔</option>{hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label><table><thead><tr><th>호텔</th><th>객실</th><th>상태</th><th>QR 관리</th></tr></thead><tbody>{rooms.map(r=><tr key={r.id}><td>{r.hotel.name}</td><td>{r.roomNumber}</td><td>{r.status}</td><td><button disabled title="QR 관리는 MVP 이후 제공됩니다.">준비 중</button></td></tr>)}</tbody></table></section></div>; }

function Page({ auth, title, subtitle, children }: React.PropsWithChildren<{ auth: AgentAuth; title: string; subtitle: string }>): React.JSX.Element {
  function logout(): void { sessionStorage.removeItem("hotel-chat-agent-auth"); location.href = "/login"; }
  return <div className="shell"><aside><div className="brand">REMOTE<span>+</span></div><nav><Link to="/agent">Agent 상담</Link><Link to="/admin">관리자 페이지</Link></nav><small>Hotel Chat MVP</small></aside><main><header><div><h1>{title}</h1><p>{subtitle}</p></div><div className="profile">{auth.agent.name}<span>AG</span><button className="link-button" onClick={logout}>로그아웃</button></div></header>{children}</main></div>;
}

/** 인증 상태에 따라 로그인과 Agent 업무 화면 접근을 분리합니다. */
function App(): React.JSX.Element { const [auth,setAuth]=useState<AgentAuth|null>(()=>readAuth()); const [adminAuth,setAdminAuth]=useState<AgentAuth|null>(()=>{try{return JSON.parse(sessionStorage.getItem("hotel-chat-admin-auth")??"null");}catch{return null;}}); return <Routes><Route path="/login" element={auth?.agent.role==="AGENT"?<Navigate to="/agent" replace/>:<LoginPage onLogin={setAuth}/>}/><Route path="/agent" element={auth?.agent.role==="AGENT"?<AgentPage auth={auth}/>:<Navigate to="/login" replace/>}/><Route path="/admin/login" element={adminAuth?.agent.role==="ADMIN"?<Navigate to="/admin" replace/>:<AdminLogin onLogin={setAdminAuth}/>}/><Route path="/admin" element={adminAuth?.agent.role==="ADMIN"?<AdminPage auth={adminAuth}/>:<Navigate to="/admin/login" replace/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>; }

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
