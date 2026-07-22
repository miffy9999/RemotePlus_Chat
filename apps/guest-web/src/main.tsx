import React, { FormEvent, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import { createSession, getMessages, getSession, SOCKET_URL, type GuestMessage, type GuestSession, type StoredGuestAccess, verifyAccess } from "./api";
import { mergeMessage, remainingTime, scrollChatToLatest } from "./chat-utils";
import { LanguageProvider, useI18n } from "./i18n";
import "./styles.css";

type ScreenState = "loading" | "consent" | "ready" | "error";

/** 접근 키별 상담 토큰을 현재 브라우저 탭에만 보관해 새로고침 복구와 노출 최소화를 함께 만족합니다. */
function storageKey(accessKey: string): string { return `hotel-chat-guest:${accessKey}`; }

/** 테스트 링크 진입부터 상담 생성·복구, Socket.IO 채팅까지 투숙객 전체 흐름을 담당합니다. */
function GuestApp(): React.JSX.Element {
  const { language: uiLanguage, setLanguage: setUiLanguage, locale, t } = useI18n();
  const accessKey = new URLSearchParams(location.search).get("accessKey") ?? "";
  const [screen, setScreen] = useState<ScreenState>("loading"); const [error, setError] = useState(""); const [access, setAccess] = useState<StoredGuestAccess | null>(null); const [messages, setMessages] = useState<GuestMessage[]>([]); const [input, setInput] = useState(""); const [connection, setConnection] = useState("연결 중"); const [now, setNow] = useState(Date.now()); const socketRef = useRef<Socket | null>(null);
  const [language, setLanguage] = useState<string>(uiLanguage); const [agreed, setAgreed] = useState(false); const [starting, setStarting] = useState(false);
  const preparationStarted = useRef(false);
  const messagesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // React StrictMode의 개발용 효과 재실행에서도 상담 생성 요청은 한 번만 전송합니다.
    if (preparationStarted.current) return;
    preparationStarted.current = true;
    async function prepare(): Promise<void> {
      if (!accessKey) { setError("접근 키가 없는 링크입니다. 테스트 링크의 accessKey 값을 확인하세요."); setScreen("error"); return; }
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey(accessKey)) ?? "null") as StoredGuestAccess | null;
        if (stored) { try { const session = await getSession(stored.session.id, stored.guestToken); setAccess({ ...stored, session }); setScreen("ready"); return; } catch { sessionStorage.removeItem(storageKey(accessKey)); } }
        // 저장된 상담이 없다면 자동 생성하지 않고 사용자가 언어와 이용 안내를 확인하도록 합니다.
        setScreen("consent");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "상담을 시작하지 못했습니다."); setScreen("error"); }
    }
    // StrictMode가 효과를 정리해도 이미 시작한 단일 초기화 요청의 결과는 현재 화면에 반영합니다.
    void prepare();
  }, [accessKey]);

  useEffect(() => {
    if (!access) return; let active = true;
    getMessages(access.session.id, access.guestToken).then((history) => active && setMessages(history)).catch((reason) => active && setError(reason.message));
    const socket = io(SOCKET_URL, { auth: { guestToken: access.guestToken, sessionId: access.session.id }, transports: ["websocket"] }); socketRef.current = socket;
    socket.on("connect", async () => { setConnection("연결됨"); const joined = await socket.emitWithAck("chat:join", { sessionId: access.session.id }); if (!joined?.ok) setError(joined?.error?.message ?? "상담방 입장에 실패했습니다."); });
    socket.on("disconnect", () => setConnection("연결 끊김")); socket.io.on("reconnect_attempt", () => setConnection("재연결 중"));
    socket.on("chat:message", (message: GuestMessage) => setMessages((items) => mergeMessage(items, message))); socket.on("chat:message-accepted", (message: GuestMessage) => setMessages((items) => mergeMessage(items, message)));
    socket.on("chat:session-updated", (session: GuestSession) => { if (session.id === access.session.id) setAccess((current) => current ? { ...current, session } : current); }); socket.on("chat:session-closed", (session: GuestSession) => { if (session.id === access.session.id) setAccess((current) => current ? { ...current, session } : current); }); socket.on("chat:error", (payload: { message: string }) => setError(payload.message));
    return () => { active = false; socket.disconnect(); socketRef.current = null; };
  }, [access?.session.id, access?.guestToken]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    // 새 메시지와 상담 종료 이벤트가 반영될 때 채팅 목록만 아래로 이동해 휴대폰 전체 화면이 튀지 않게 합니다.
    const frame = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) scrollChatToLatest(container, messages.length > 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, access?.session.status]);
  /** 동의 버튼을 누른 시점에만 접근 키를 검증하고 새 상담을 생성합니다. */
  async function startConsultation(): Promise<void> { if (!agreed || starting) return; setStarting(true); setError(""); try { const verified = await verifyAccess(accessKey); const created = await createSession(verified.accessToken, language); sessionStorage.setItem(storageKey(accessKey), JSON.stringify(created)); setAccess(created); setScreen("ready"); } catch (reason) { setError(reason instanceof Error ? reason.message : "상담을 시작하지 못했습니다."); setScreen("error"); } finally { setStarting(false); } }
  async function send(event: FormEvent): Promise<void> { event.preventDefault(); const content = input.trim(); if (!content || !access || access.session.status !== "ACTIVE" || !socketRef.current) return; setInput(""); const result = await socketRef.current.emitWithAck("chat:message", { sessionId: access.session.id, clientMessageId: crypto.randomUUID(), content }); if (!result?.ok) setError(result?.error?.message ?? "메시지 전송에 실패했습니다."); }

  if (screen === "loading") return <div className="center-card"><div className="spinner"/><h1>{t("상담을 준비하고 있습니다")}</h1><p>{t("객실 접근 정보를 안전하게 확인하는 중입니다.")}</p></div>;
  if (screen === "consent") return <div className="center-card"><div className="consent-card"><span className="eyebrow">HOTEL SUPPORT</span><h1>{t("실시간 상담 시작")}</h1><p>{t("상담은 최대 15분 동안 진행되며 텍스트 메시지만 지원합니다.")}</p><label>{t("상담 언어")}<select value={language} onChange={(event) => { const selected=event.target.value; setLanguage(selected); setUiLanguage(selected==="ko"?"ko":"ja"); }}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option><option value="zh">中文</option></select></label><label className="agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>{t("상담 내용이 서비스 제공과 안전한 운영을 위해 저장될 수 있음을 확인했습니다. 비밀번호와 결제정보는 입력하지 않겠습니다.")}</span></label><button onClick={() => void startConsultation()} disabled={!agreed || starting}>{t(starting ? "상담 준비 중…" : "상담 시작")}</button></div></div>;
  if (screen === "error" || !access) return <div className="center-card error-state"><h1>{t("상담을 시작할 수 없습니다")}</h1><p>{error}</p><code>?accessKey=demo-room-access-1201</code></div>;
  const writable = access.session.status === "ACTIVE" && new Date(access.session.expiresAt).getTime() > now;
  return <main className="guest-shell"><header><div><strong>{t("호텔 고객지원")}</strong><span>{access.session.room.hotel.name} · {access.session.room.roomNumber}{uiLanguage === "ja" ? "号室" : "호"}</span></div><div className="guest-header-actions"><span className={`online ${connection === "연결됨" ? "ok" : ""}`}>● {t(connection)}</span></div></header><section className={`notice ${access.session.status.toLowerCase()}`}>{t(access.session.status === "WAITING" ? "상담원 연결을 기다리고 있습니다. 연결되면 메시지를 보낼 수 있습니다." : access.session.status === "ACTIVE" ? "상담원이 연결되었습니다. 개인정보나 결제 비밀번호는 전송하지 마세요." : "상담이 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.")}</section>{error && <section className="error-box">{error}</section>}<section className="messages" ref={messagesRef}>{messages.length === 0 && <div className="empty">{t(access.session.status === "WAITING" ? "잠시만 기다려 주세요." : "첫 메시지를 보내보세요.")}</div>}{messages.map((message) => <div key={message.id} className={`message ${message.senderType === "GUEST" ? "guest" : "agent"}`}><small>{t(message.senderType === "GUEST" ? "나" : "상담원")} · {new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</small><p>{message.content}</p></div>)}</section><footer><div className="timer"><span>{t("남은 상담 시간")}</span><strong>{["CLOSED", "EXPIRED"].includes(access.session.status) ? t("종료") : remainingTime(access.session.expiresAt, now)}</strong></div><form className="composer" onSubmit={send}><input aria-label={t("메시지")} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder={t(writable ? "메시지를 입력하세요" : "상담원 연결 또는 종료 상태를 확인하세요")} disabled={!writable}/><button disabled={!writable || !input.trim()}>{t("전송")}</button></form></footer></main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><LanguageProvider><GuestApp /></LanguageProvider></React.StrictMode>);
