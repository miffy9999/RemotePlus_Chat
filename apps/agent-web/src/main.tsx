import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { acceptSession, closeSession, createAdminAgent, createHotel, createRoom, deleteAdminAgent, deleteHotel, deleteRoom, getMessages, listAdminAgents, listHotels, listRooms, listSessions, login, loginAdmin, type AdminAgentView, type HotelView, type MessageView, type RoomView, type SessionView, SOCKET_URL } from "./api";
import { mergeMessage, remainingTime, scrollChatToLatest } from "./chat-utils";
import { LanguageProvider, LanguageSwitcher, useI18n } from "./i18n";
import { AUTH_INVALID_EVENT, clearStoredAuth, readStoredAuth, saveStoredAuth, type AgentAuth } from "./auth-storage";
import "./styles.css";

/** 기본 진입 화면에서 사용자가 자신의 역할을 먼저 선택해 관리자와 Agent 인증 흐름을 명확히 구분합니다. */
function RoleSelection(): React.JSX.Element {
  const { t } = useI18n();
  return <div className="role-shell"><LanguageSwitcher/><main className="role-card"><div className="brand dark">REMOTE<span>+</span></div><h1>{t("호텔 상담 센터")}</h1><p>{t("이용할 업무 화면을 선택한 뒤 로그인하세요.")}</p><div className="role-actions"><Link className="role-action admin" to="/admin/login"><strong>{t("관리자 로그인")}</strong><span>{t("호텔·룸·Agent를 관리합니다.")}</span></Link><Link className="role-action agent" to="/login"><strong>{t("Agent 로그인")}</strong><span>{t("투숙객 상담을 처리합니다.")}</span></Link></div></main></div>;
}

/** 실제 Agent API를 호출하는 로그인 화면입니다. */
function LoginPage({ onLogin }: { onLogin: (auth: AgentAuth) => void }): React.JSX.Element {
  const { t } = useI18n();
  const [loginId, setLoginId] = useState("agent01");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault(); setLoading(true); setError("");
    try { const auth = await login(loginId, password); saveStoredAuth(auth); onLogin(auth); navigate("/agent"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "로그인에 실패했습니다."); }
    finally { setLoading(false); }
  }

  return <div className="login-shell"><LanguageSwitcher/><form className="login-card" onSubmit={submit}><div className="brand dark">REMOTE<span>+</span></div><h1>{t("Agent 로그인")}</h1><p>{t("상담 센터 계정으로 로그인하세요.")}</p><label>{t("로그인 ID")}<input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" /></label><label>{t("비밀번호")}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>{error && <div className="error-box">{error}</div>}<button disabled={loading}>{t(loading ? "로그인 중…" : "로그인")}</button><small>{t("개발용 계정은 `.env.example`에서 확인할 수 있습니다.")}</small></form></div>;
}

/** 선택한 상담에 Socket.IO로 연결하고 메시지 이력·전송·종료를 처리합니다. */
function AgentChat({ auth, initial, onBack, onChanged }: { auth: AgentAuth; initial: SessionView; onBack: () => void; onChanged: () => void }): React.JSX.Element {
  const { language, locale, t } = useI18n();
  const [session, setSession] = useState(initial);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState("연결 중");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    // 새 메시지와 종료 상태를 채팅 영역 안에서만 아래로 이동해 전체 페이지가 위로 튀는 현상을 막습니다.
    const frame = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) scrollChatToLatest(container, messages.length > 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, session.status]);

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault(); const content = input.trim(); if (!content || !socketRef.current || session.status !== "ACTIVE") return;
    setInput(""); const result = await socketRef.current.emitWithAck("chat:message", { sessionId: session.id, clientMessageId: crypto.randomUUID(), content });
    if (!result?.ok) setError(result?.error?.message ?? "메시지 전송에 실패했습니다.");
  }

  /** 브라우저 기본 확인창 대신 화면 안의 확인창을 사용해 모바일과 자동화 환경에서도 같은 흐름을 제공합니다. */
  async function close(): Promise<void> { try { setSession(await closeSession(auth.accessToken, session.id)); setShowCloseConfirm(false); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : "종료에 실패했습니다."); } }

  return <Page auth={auth} chatMode title={`${session.room.roomNumber}${language === "ja" ? "号室の相談" : "호 상담"}`} subtitle={`${session.room.hotel.name} · ${session.language.toUpperCase()}`}><div className="chat-card"><div className="chat-toolbar"><button className="secondary" onClick={onBack}>{t("← 목록")}</button><div className="mobile-chat-title"><strong>{session.room.roomNumber}{language === "ja" ? "号室" : "호"}</strong><span>{session.room.hotel.name}</span></div><div className="chat-actions"><span className={`connection ${connection === "연결됨" ? "ok" : ""}`}>● {t(connection)}</span><strong>{session.status === "ACTIVE" ? remainingTime(session.expiresAt, now) : t("종료")}</strong><button className="danger" onClick={() => setShowCloseConfirm(true)} disabled={session.status !== "ACTIVE"}>{t("상담 종료")}</button></div></div>{error && <div className="error-box">{error}</div>}<div className="chat-messages" ref={messagesRef}>{messages.length === 0 && <div className="empty">{t("아직 메시지가 없습니다.")}</div>}{messages.map((message) => <div key={message.id} className={`bubble ${message.senderType === "AGENT" ? "mine" : "theirs"}`}><small>{t(message.senderType === "AGENT" ? "나" : "투숙객")} · {new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</small><p>{message.content}</p></div>)}</div><form className="chat-composer" onSubmit={send}><input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder={t(session.status === "ACTIVE" ? "메시지를 입력하세요" : "종료된 상담입니다")} disabled={session.status !== "ACTIVE"}/><button disabled={!input.trim() || session.status !== "ACTIVE"}>{t("전송")}</button></form></div>{showCloseConfirm && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="close-title"><h2 id="close-title">{t("상담을 종료할까요?")}</h2><p>{t("종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.")}</p><div><button className="secondary" onClick={() => setShowCloseConfirm(false)}>{t("취소")}</button><button className="danger" onClick={() => void close()}>{t("상담 종료")}</button></div></section></div>}</Page>;
}

/** 상담 목록은 서버 데이터를 주기적으로 새로 받아 대기·진행·종료 상태를 보여줍니다. */
function AgentPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const previousWaiting = useRef(0);
  const listScrollPosition = useRef(0);

  async function refresh(): Promise<void> {
    try { const data = await listSessions(auth.accessToken); const waiting = data.filter((item) => item.status === "WAITING").length; if (previousWaiting.current && waiting > previousWaiting.current) playNotificationSound(); previousWaiting.current = waiting; setSessions(data); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "상담 목록을 불러오지 못했습니다."); }
  }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); }, []);

  const waiting = useMemo(() => sessions.filter((item) => item.status === "WAITING"), [sessions]);
  const active = useMemo(() => sessions.filter((item) => item.status === "ACTIVE" && item.agentId === auth.agent.id), [sessions, auth.agent.id]);
  const closed = useMemo(() => sessions.filter((item) => ["CLOSED", "EXPIRED"].includes(item.status) && item.agentId === auth.agent.id), [sessions, auth.agent.id]);
  if (selected) return <AgentChat auth={auth} initial={selected} onBack={() => {
    setSelected(null); void refresh();
    // 채팅에서 목록으로 돌아올 때 상담을 열기 전 위치를 복원해 긴 목록의 맨 위로 튀지 않게 합니다.
    window.requestAnimationFrame(() => window.scrollTo({ top: listScrollPosition.current, behavior: "auto" }));
  }} onChanged={() => void refresh()} />;

  function open(session: SessionView): void { listScrollPosition.current = window.scrollY; setSelected(session); }
  async function accept(session: SessionView): Promise<void> { listScrollPosition.current = window.scrollY; try { setSelected(await acceptSession(auth.accessToken, session.id)); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "상담 수락에 실패했습니다."); await refresh(); } }

  return <Page auth={auth} title={t("Agent 상담 센터")} subtitle={t("대기 중인 상담을 확인하고 응답합니다.")}><div className="stats"><article><span>{t("대기")}</span><strong>{waiting.length}</strong></article><article><span>{t("내 진행")}</span><strong>{active.length}</strong></article><article><span>{t("내 종료")}</span><strong>{closed.length}</strong></article></div>{error && <div className="error-box">{error}</div>}<section className="card"><div className="section-head"><div><h2>{t("대기 상담")}</h2><p>{t("오래 기다린 상담부터 확인하세요.")}</p></div><button onClick={() => void refresh()}>{t("새로고침")}</button></div><SessionTable items={waiting} action={(session) => <button onClick={() => void accept(session)}>{t("상담 수락")}</button>} /></section><section className="card"><div className="section-head"><div><h2>{t("내 진행 상담")}</h2><p>{t("현재 담당 중인 상담입니다.")}</p></div></div><SessionTable items={active} action={(session) => <button onClick={() => open(session)}>{t("상담 열기")}</button>} /></section><section className="card"><div className="section-head"><div><h2>{t("종료 상담")}</h2><p>{t("최근 종료되거나 만료된 내 상담입니다.")}</p></div></div><SessionTable items={closed.slice(0, 10)} action={(session) => <button onClick={() => open(session)}>{t("기록 보기")}</button>} /></section></Page>;
}

/** 상담 목록의 공통 열을 한 컴포넌트로 관리해 상태별 표가 서로 달라지지 않게 합니다. */
function SessionTable({ items, action }: { items: SessionView[]; action: (session: SessionView) => React.ReactNode }): React.JSX.Element {
  const { locale, t } = useI18n();
  // 모바일에서는 data-label을 행 카드의 항목명으로 표시해 가로 스크롤 없이 상담 핵심 정보를 읽을 수 있게 합니다.
  return <div className="table-wrap session-table"><table><thead><tr><th>{t("호텔")}</th><th>{t("객실")}</th><th>{t("언어")}</th><th>{t("상태")}</th><th>{t("만료 시각")}</th><th>{t("작업")}</th></tr></thead><tbody>{items.length === 0 ? <tr className="empty-row"><td colSpan={6} className="empty">{t("표시할 상담이 없습니다.")}</td></tr> : items.map((session) => <tr key={session.id}><td data-label={t("호텔")}>{session.room.hotel.name}</td><td data-label={t("객실")}>{session.room.roomNumber}</td><td data-label={t("언어")}>{session.language.toUpperCase()}</td><td data-label={t("상태")}><span className={`badge ${session.status.toLowerCase()}`}>{session.status}</span></td><td data-label={t("만료 시각")}>{new Date(session.expiresAt).toLocaleTimeString(locale)}</td><td data-label={t("작업")}>{action(session)}</td></tr>)}</tbody></table></div>;
}

/** 브라우저 정책으로 소리가 차단될 수 있으므로 실패해도 화면 동작은 계속합니다. */
function playNotificationSound(): void { try { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.frequency.value = 880; oscillator.start(); oscillator.stop(context.currentTime + 0.12); } catch { /* 화면 강조가 기본 알림 수단입니다. */ } }

/** 기존 관리자 화면은 Phase 3A 전까지 QR 비활성 원칙을 보여주는 정적 화면으로 유지합니다. */
/** 관리자 전용 로그인은 Agent 토큰과 다른 저장 키를 사용해 역할 화면이 섞이지 않게 합니다. */
function AdminLogin({ onLogin }: { onLogin: (auth: AgentAuth) => void }): React.JSX.Element { const {t}=useI18n(); const [loginId,setLoginId]=useState("admin"); const [password,setPassword]=useState(""); const [error,setError]=useState(""); async function submit(e:FormEvent){e.preventDefault();try{const value=await loginAdmin(loginId,password);saveStoredAuth(value);onLogin(value);}catch(reason){setError(reason instanceof Error?reason.message:"로그인에 실패했습니다.");}} return <div className="login-shell"><LanguageSwitcher/><form className="login-card" onSubmit={submit}><div className="brand dark">REMOTE<span>+</span></div><h1>{t("관리자 로그인")}</h1><label>{t("로그인 ID")}<input value={loginId} onChange={e=>setLoginId(e.target.value)} autoComplete="username"/></label><label>{t("비밀번호")}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>{error&&<div className="error-box">{error}</div>}<button>{t("로그인")}</button></form></div>; }

/** 관리자만 받은 투숙객 주소를 클립보드에 복사합니다. 실패하면 호출부가 화면 오류로 안내합니다. */
async function copyGuestUrl(url: string): Promise<void> { await navigator.clipboard.writeText(url); }

/** 관리자 MVP는 Agent·호텔·룸 CRUD와 룸별 투숙객 주소 조회를 제공하며 QR은 후속 확장 자리만 둡니다. */
function AdminPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const { language, t } = useI18n();
  const [agents, setAgents] = useState<AdminAgentView[]>([]); const [hotels, setHotels] = useState<HotelView[]>([]); const [rooms, setRooms] = useState<RoomView[]>([]); const [filter, setFilter] = useState(""); const [error, setError] = useState("");
  const [agentForm, setAgentForm] = useState({ name: "", loginId: "", password: "" }); const [hotelName, setHotelName] = useState(""); const [roomNumber, setRoomNumber] = useState(""); const [roomHotelId, setRoomHotelId] = useState("");
  async function refresh() { try { const [a,h,r] = await Promise.all([listAdminAgents(auth.accessToken), listHotels(auth.accessToken), listRooms(auth.accessToken, filter || undefined)]); setAgents(a); setHotels(h); setRooms(r); setRoomHotelId((current) => h.some((hotel) => hotel.id === current) ? current : (h[0]?.id ?? "")); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "관리 데이터를 불러오지 못했습니다."); } }
  useEffect(() => { void refresh(); }, [filter]);
  async function addAgent(e: FormEvent) { e.preventDefault(); try { await createAdminAgent(auth.accessToken, agentForm); setAgentForm({ name: "", loginId: "", password: "" }); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Agent 추가 실패"); } }
  async function addHotel(e: FormEvent) { e.preventDefault(); try { await createHotel(auth.accessToken, hotelName); setHotelName(""); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "호텔 추가 실패"); } }
  async function addRoom(e: FormEvent) { e.preventDefault(); try { await createRoom(auth.accessToken, roomHotelId, roomNumber); setRoomNumber(""); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "룸 추가 실패"); } }
  /** 삭제 전 영향을 명확히 알리고 확인받아 실수로 운영 데이터를 제거하는 일을 줄입니다. */
  async function removeAgent(agent: AdminAgentView) { const message=language==="ja"?`${agent.name}（${agent.loginId}）Agentを削除しますか？既存の相談履歴は保持されます。`:`${agent.name} (${agent.loginId}) Agent를 삭제할까요? 기존 상담 기록은 유지됩니다.`; if (!window.confirm(message)) return; try { await deleteAdminAgent(auth.accessToken, agent.id); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Agent 삭제 실패"); } }
  async function removeHotel(hotel: HotelView) { const message=language==="ja"?`${hotel.name}を削除しますか？配下の客室とすべての相談・メッセージも削除され、元に戻せません。`:`${hotel.name} 호텔을 삭제할까요? 하위 룸과 모든 상담·메시지도 함께 삭제되며 복구할 수 없습니다.`; if (!window.confirm(message)) return; try { await deleteHotel(auth.accessToken, hotel.id); if (filter === hotel.id) setFilter(""); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "호텔 삭제 실패"); } }
  async function removeRoom(room: RoomView) { const message=language==="ja"?`${room.hotel.name} ${room.roomNumber}号室を削除しますか？アクセスキーと相談・メッセージも削除され、元に戻せません。`:`${room.hotel.name} ${room.roomNumber} 룸을 삭제할까요? 접근키와 상담·메시지도 함께 삭제되며 복구할 수 없습니다.`; if (!window.confirm(message)) return; try { await deleteRoom(auth.accessToken, room.id); await refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "룸 삭제 실패"); } }
  function logout() { clearStoredAuth("ADMIN"); location.href = "/admin/login"; }
  return <div className="admin-shell"><header><div><div className="brand dark">REMOTE<span>+</span></div><h1>{t("관리자 페이지")}</h1></div><div className="admin-header-actions"><LanguageSwitcher/><button className="secondary" onClick={logout}>{t("로그아웃")}</button></div></header>{error && <div className="error-box">{error}</div>}<section className="card"><h2>{t("Agent 관리")}</h2><form className="inline-form" onSubmit={addAgent}><input aria-label={t("Agent 이름")} placeholder={t("이름")} value={agentForm.name} onChange={(e)=>setAgentForm({...agentForm,name:e.target.value})}/><input aria-label={t("Agent 로그인 ID")} placeholder={t("로그인 ID")} value={agentForm.loginId} onChange={(e)=>setAgentForm({...agentForm,loginId:e.target.value})}/><input aria-label={t("Agent 비밀번호")} type="password" placeholder={t("영문+숫자 8자 이상")} value={agentForm.password} onChange={(e)=>setAgentForm({...agentForm,password:e.target.value})}/><button>{t("Agent 추가")}</button></form><div className="table-wrap admin-table"><table><thead><tr><th>{t("이름")}</th><th>{t("ID")}</th><th>{t("상태")}</th><th>{t("관리")}</th></tr></thead><tbody>{agents.map((agent)=><tr key={agent.id}><td data-label={t("이름")}>{agent.name}</td><td data-label={t("ID")}>{agent.loginId}</td><td data-label={t("상태")}>{agent.status}</td><td data-label={t("관리")}><button className="danger compact" onClick={() => void removeAgent(agent)}>{t("삭제")}</button></td></tr>)}</tbody></table></div></section><section className="card"><h2>{t("호텔·룸 관리")}</h2><form className="inline-form" onSubmit={addHotel}><input aria-label={t("호텔 이름")} placeholder={t("호텔 이름")} value={hotelName} onChange={(e)=>setHotelName(e.target.value)}/><button>{t("호텔 추가")}</button></form><form className="inline-form" onSubmit={addRoom}><select aria-label={t("룸을 추가할 호텔")} value={roomHotelId} onChange={(e)=>setRoomHotelId(e.target.value)}>{hotels.map((hotel)=><option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select><input aria-label={t("객실 번호")} placeholder={t("객실 번호")} value={roomNumber} onChange={(e)=>setRoomNumber(e.target.value)}/><button>{t("룸 추가")}</button><button type="button" className="danger" disabled={!roomHotelId} onClick={() => { const hotel = hotels.find((item) => item.id === roomHotelId); if (hotel) void removeHotel(hotel); }}>{t("선택 호텔 삭제")}</button></form><label className="filter">{t("호텔 필터")}<select value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="">{t("전체 호텔")}</option>{hotels.map((hotel)=><option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</select></label><div className="table-wrap admin-table"><table><thead><tr><th>{t("호텔")}</th><th>{t("객실")}</th><th>{t("상태")}</th><th>{t("투숙객 주소")}</th><th>{t("QR 관리")}</th><th>{t("관리")}</th></tr></thead><tbody>{rooms.map((room)=><tr key={room.id}><td data-label={t("호텔")}>{room.hotel.name}</td><td data-label={t("객실")}>{room.roomNumber}</td><td data-label={t("상태")}>{room.status}</td><td data-label={t("투숙객 주소")} className="room-link-cell">{room.guestUrl ? <><a href={room.guestUrl} target="_blank" rel="noreferrer">{t("상담 링크 열기")}</a><button className="secondary compact" onClick={() => void copyGuestUrl(room.guestUrl!).catch(()=>setError("주소를 복사하지 못했습니다."))}>{t("주소 복사")}</button></> : <span>{t("주소 없음")}</span>}</td><td data-label={t("QR 관리")}><button disabled title={t("QR 관리는 MVP 이후 제공됩니다.")}>{t("준비 중")}</button></td><td data-label={t("관리")}><button className="danger compact" onClick={() => void removeRoom(room)}>{t("삭제")}</button></td></tr>)}</tbody></table></div></section></div>;
}

function Page({ auth, title, subtitle, chatMode = false, children }: React.PropsWithChildren<{ auth: AgentAuth; title: string; subtitle: string; chatMode?: boolean }>): React.JSX.Element {
  const { t } = useI18n();
  function logout(): void { clearStoredAuth("AGENT"); location.href = "/login"; }
  return <div className={`shell ${chatMode ? "chat-shell" : ""}`}><aside><div className="brand">REMOTE<span>+</span></div><LanguageSwitcher/><nav><Link to="/agent">{t("Agent 상담")}</Link><Link to="/admin">{t("관리자 페이지")}</Link></nav><small>Hotel Chat MVP</small></aside><main className={chatMode ? "chat-page" : ""}><header><div className="mobile-brand">REMOTE<span>+</span></div><div className="page-heading"><h1>{title}</h1><p>{subtitle}</p></div><div className="profile">{auth.agent.name}<span>AG</span><button className="link-button" onClick={logout}>{t("로그아웃")}</button></div></header>{children}</main></div>;
}

/** 인증 상태에 따라 로그인과 Agent 업무 화면 접근을 분리합니다. */
function App(): React.JSX.Element {
  const [auth, setAuth] = useState<AgentAuth | null>(() => readStoredAuth("AGENT"));
  const [adminAuth, setAdminAuth] = useState<AgentAuth | null>(() => readStoredAuth("ADMIN"));

  useEffect(() => {
    /** 서버가 저장된 JWT를 거부하면 오래된 인증을 남기지 않고 역할별 로그인 화면으로 되돌립니다. */
    function invalidateAuth(): void {
      clearStoredAuth("AGENT"); clearStoredAuth("ADMIN"); setAuth(null); setAdminAuth(null);
    }
    window.addEventListener(AUTH_INVALID_EVENT, invalidateAuth);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, invalidateAuth);
  }, []);

  return <Routes><Route path="/" element={<RoleSelection/>}/><Route path="/login" element={auth?.agent.role==="AGENT"?<Navigate to="/agent" replace/>:<LoginPage onLogin={setAuth}/>}/><Route path="/agent" element={auth?.agent.role==="AGENT"?<AgentPage auth={auth}/>:<Navigate to="/login" replace/>}/><Route path="/admin/login" element={adminAuth?.agent.role==="ADMIN"?<Navigate to="/admin" replace/>:<AdminLogin onLogin={setAdminAuth}/>}/><Route path="/admin" element={adminAuth?.agent.role==="ADMIN"?<AdminPage auth={adminAuth}/>:<Navigate to="/admin/login" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><LanguageProvider><BrowserRouter><App /></BrowserRouter></LanguageProvider></React.StrictMode>);
