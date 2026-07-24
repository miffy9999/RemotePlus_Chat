import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import {
  acceptSession,
  changeStaffPassword,
  closeSession,
  createAdminAgent,
  createHotel,
  createRoom,
  deleteAdminAgent,
  deleteHotel,
  deleteRoom,
  getMessages,
  listAdminAgents,
  listHotels,
  listRooms,
  listSessions,
  loginStaff,
  openSession,
  type AdminAgentView,
  type HotelView,
  type MessageView,
  type RoomView,
  type SessionView,
  SOCKET_URL,
  updateHotelWelcomeMessage,
} from "./api";
import { mergeMessage, remainingTime, scrollChatToLatest } from "./chat-utils";
import { filterAgentSessions } from "./session-filters";
import { LanguageProvider, LanguageSwitcher, useI18n } from "./i18n";
import {
  AUTH_INVALID_EVENT,
  clearStoredAuth,
  readStoredAuth,
  saveStoredAuth,
  type AgentAuth,
} from "./auth-storage";
import {
  createRoomQrDataUrl,
  createRoomQrFileName,
  downloadRoomQr,
} from "./qr-code";
import {
  findNewWaitingSessions,
  notificationPreview,
  readNotificationSoundEnabled,
  saveNotificationSoundEnabled,
  sortSessionsByRecentActivity,
  waitingSessionIds,
} from "./notification-utils";
import { createTitleFlasher, type TitleFlasher } from "./title-flasher";
import {
  ADMIN_AGENT_WORKSPACE_PATH,
  ADMIN_DASHBOARD_PATH,
  AGENT_WORKSPACE_PATH,
  canAccessStaffPath,
  staffHomePath,
} from "./staff-routing";
import { filterConversationLogs } from "./conversation-logs";
import {
  readLoginPreference,
  requestBrowserCredentialSave,
  saveLoginPreference,
  type LoginSaveMode,
} from "./login-preferences";
import {
  AGENT_SIDEBAR_MAX_WIDTH,
  AGENT_SIDEBAR_MIN_WIDTH,
  clampAgentSidebarWidth,
  readAgentSidebarWidth,
  saveAgentSidebarWidth,
} from "./agent-layout";
import "./styles.css";

/** 한 로그인 폼에서 서버가 판별한 직원 역할에 따라 관리자 또는 Agent 업무 화면으로 이동합니다. */
function LoginPage({
  onLogin,
}: {
  onLogin: (auth: AgentAuth) => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const [initialPreference] = useState(readLoginPreference);
  const [loginId, setLoginId] = useState(initialPreference.loginId);
  const [password, setPassword] = useState("");
  const [saveMode, setSaveMode] = useState<LoginSaveMode>(
    initialPreference.mode,
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = await loginStaff(loginId, password);
      // 이전 역할로 로그인했던 탭의 인증을 함께 남기지 않아 보호 경로가 오래된 역할을 선택하는 일을 막습니다.
      clearStoredAuth(auth.agent.role === "ADMIN" ? "AGENT" : "ADMIN");
      saveStoredAuth(auth);
      saveLoginPreference(saveMode, loginId);
      // 비밀번호는 앱 저장소에 기록하지 않고, 사용자가 로그인 정보 저장을 고른 경우에만 브라우저의 안전한 비밀번호 관리자에 위임합니다.
      if (saveMode === "CREDENTIALS") {
        await requestBrowserCredentialSave(loginId, password);
      }
      onLogin(auth);
      navigate(staffHomePath(auth.agent.role));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "로그인에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <LanguageSwitcher />
      <form className="login-card" onSubmit={submit}>
        <div className="brand dark">
          REMOTE<span>+</span>
        </div>
        <h1>{t("직원 로그인")}</h1>
        <p>{t("상담 센터 계정으로 로그인하세요.")}</p>
        <label>
          {t("로그인 ID")}
          <input
            id="staff-login-id"
            name="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          {t("비밀번호")}
          <input
            id="staff-login-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <div
          className="login-save-options"
          role="group"
          aria-label={t("로그인 정보 저장 방식")}
        >
          <button
            type="button"
            className={saveMode === "ID" ? "is-active" : ""}
            aria-pressed={saveMode === "ID"}
            onClick={() =>
              setSaveMode((current) => (current === "ID" ? "NONE" : "ID"))
            }
          >
            <span aria-hidden="true">✓</span>
            {t("아이디 저장")}
          </button>
          <button
            type="button"
            className={saveMode === "CREDENTIALS" ? "is-active" : ""}
            aria-pressed={saveMode === "CREDENTIALS"}
            onClick={() =>
              setSaveMode((current) =>
                current === "CREDENTIALS" ? "NONE" : "CREDENTIALS",
              )
            }
          >
            <span aria-hidden="true">✓</span>
            {t("로그인 정보 저장")}
          </button>
        </div>
        <small className="login-save-help">
          {t(
            "로그인 정보 저장은 브라우저 비밀번호 관리자를 사용합니다. 선택한 버튼을 다시 누르면 해제됩니다.",
          )}
        </small>
        {error && <div className="error-box">{error}</div>}
        <button disabled={loading}>
          {t(loading ? "로그인 중…" : "로그인")}
        </button>
        <small>
          {t("계정 역할에 따라 관리 또는 상담 화면으로 이동합니다.")}
        </small>
      </form>
    </div>
  );
}

/** 선택한 상담에 Socket.IO로 연결하고 메시지 이력·전송·종료를 처리합니다. */
function AgentChat({
  auth,
  initial,
  onBack,
  onChanged,
}: {
  auth: AgentAuth;
  initial: SessionView;
  onBack: () => void;
  onChanged: () => void;
}): React.JSX.Element {
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
    getMessages(auth.accessToken, session.id)
      .then((history) => active && setMessages(history))
      .catch((reason) => active && setError(reason.message));
    const socket = io(SOCKET_URL, {
      auth: { staffToken: auth.accessToken },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    socket.on("connect", async () => {
      setConnection("연결됨");
      const joined = await socket.emitWithAck("chat:join", {
        sessionId: session.id,
      });
      if (!joined?.ok)
        setError(joined?.error?.message ?? "상담방 입장에 실패했습니다.");
    });
    socket.on("disconnect", () => setConnection("연결 끊김"));
    socket.io.on("reconnect_attempt", () => setConnection("재연결 중"));
    socket.on("chat:message", (message: MessageView) =>
      setMessages((items) => mergeMessage(items, message)),
    );
    socket.on("chat:message-accepted", (message: MessageView) =>
      setMessages((items) => mergeMessage(items, message)),
    );
    socket.on("chat:session-closed", (updated: SessionView) => {
      if (updated.id === session.id) {
        setSession(updated);
        onChanged();
      }
    });
    socket.on("chat:error", (payload: { message: string }) =>
      setError(payload.message),
    );
    return () => {
      active = false;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth.accessToken, session.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // 새 메시지와 종료 상태를 채팅 영역 안에서만 아래로 이동해 전체 페이지가 위로 튀는 현상을 막습니다.
    const frame = window.requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (container) scrollChatToLatest(container, messages.length > 1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, session.status]);

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    const content = input.trim();
    if (!content || !socketRef.current || session.status !== "ACTIVE") return;
    setInput("");
    const result = await socketRef.current.emitWithAck("chat:message", {
      sessionId: session.id,
      clientMessageId: crypto.randomUUID(),
      content,
    });
    if (!result?.ok)
      setError(result?.error?.message ?? "메시지 전송에 실패했습니다.");
  }

  /** 브라우저 기본 확인창 대신 화면 안의 확인창을 사용해 모바일과 자동화 환경에서도 같은 흐름을 제공합니다. */
  async function close(): Promise<void> {
    try {
      setSession(await closeSession(auth.accessToken, session.id));
      setShowCloseConfirm(false);
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "종료에 실패했습니다.",
      );
    }
  }

  return (
    <Page
      auth={auth}
      chatMode
      title={`${session.room.roomNumber}${language === "ja" ? "号室の相談" : "호 상담"}`}
      subtitle={`${session.room.hotel.name} · ${session.language.toUpperCase()}`}
    >
      <div className="chat-card">
        <div className="chat-toolbar">
          <button className="secondary" onClick={onBack}>
            {t("← 목록")}
          </button>
          <div className="mobile-chat-title">
            <strong>
              {session.room.roomNumber}
              {language === "ja" ? "号室" : "호"}
            </strong>
            <span>{session.room.hotel.name}</span>
          </div>
          <div className="chat-actions">
            <span
              className={`connection ${connection === "연결됨" ? "ok" : ""}`}
            >
              ● {t(connection)}
            </span>
            <strong>
              {session.status === "ACTIVE" && session.expiresAt
                ? remainingTime(session.expiresAt, now)
                : t("종료")}
            </strong>
            <button
              className="danger"
              onClick={() => setShowCloseConfirm(true)}
              disabled={session.status !== "ACTIVE"}
            >
              {t("상담 종료")}
            </button>
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="chat-messages" ref={messagesRef}>
          {messages.length === 0 && (
            <div className="empty">{t("아직 메시지가 없습니다.")}</div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`bubble ${message.senderType === "AGENT" ? "mine" : "theirs"}`}
            >
              <small>
                {t(message.senderType === "AGENT" ? "나" : "투숙객")} ·{" "}
                {new Date(message.createdAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
        <form className="chat-composer" onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={t(
              session.status === "ACTIVE"
                ? "메시지를 입력하세요"
                : "종료된 상담입니다",
            )}
            disabled={session.status !== "ACTIVE"}
          />
          <button disabled={!input.trim() || session.status !== "ACTIVE"}>
            {t("전송")}
          </button>
        </form>
      </div>
      {showCloseConfirm && (
        <div className="modal-backdrop">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-title"
          >
            <h2 id="close-title">{t("상담을 종료할까요?")}</h2>
            <p>{t("종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.")}</p>
            <div>
              <button
                className="secondary"
                onClick={() => setShowCloseConfirm(false)}
              >
                {t("취소")}
              </button>
              <button className="danger" onClick={() => void close()}>
                {t("상담 종료")}
              </button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

interface AgentNotice {
  id: string;
  title: string;
  body: string;
  actionLabel?: string;
}

/** 화면을 보고 있지 않아도 새 상담을 알아볼 수 있도록 권한이 허용된 경우에만 운영체제 알림을 띄웁니다. */
function showSystemNotification(
  title: string,
  body: string,
  tag: string,
): void {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    document.visibilityState !== "hidden"
  )
    return;
  try {
    const notification = new Notification(title, { body, tag });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* 브라우저 알림 실패와 관계없이 화면 팝업은 계속 표시됩니다. */
  }
}

/** 하나의 최신 알림만 8초 동안 보여줘 연속 메시지가 상담 화면을 가득 덮지 않도록 합니다. */
function AgentNoticePopup({
  notice,
  onClose,
  onAction,
}: {
  notice: AgentNotice;
  onClose: () => void;
  onAction: () => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), 8000);
    return () => window.clearTimeout(timer);
  }, [notice.id]);

  // 사이드바에 사용하는 aside 태그와 분리해 모바일에서 사이드바 숨김 CSS가 팝업까지 감추지 않게 합니다.
  return (
    <section className="agent-notice" role="alert" aria-live="assertive">
      <div className="agent-notice-heading">
        <strong>{notice.title}</strong>
        <button
          type="button"
          className="link-button"
          aria-label={t("알림 닫기")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p>{notice.body}</p>
      {notice.actionLabel && (
        <button
          type="button"
          className="agent-notice-action"
          onClick={onAction}
        >
          {notice.actionLabel}
        </button>
      )}
    </section>
  );
}

const TERMINAL_SESSION_STATUSES = ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"];

/** LINE형 오른쪽 본문은 진행 상담은 실시간으로, 종료 Log는 읽기 전용으로 같은 모양에 표시합니다. */
function LineConversationPanel({
  auth,
  initial,
  readOnly,
  adminReadOnly,
  onBack,
  onChanged,
}: {
  auth: AgentAuth;
  initial: SessionView;
  readOnly: boolean;
  adminReadOnly: boolean;
  onBack: () => void;
  onChanged: (session: SessionView) => void;
}): React.JSX.Element {
  const { locale, t } = useI18n();
  const [session, setSession] = useState(initial);
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [connection, setConnection] = useState(
    readOnly ? (adminReadOnly ? "관리자 조회" : "기록 보기") : "연결 중",
  );
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setSession(initial); }, [initial]);
  useEffect(() => {
    let active = true;
    setMessages([]);
    void getMessages(auth.accessToken, session.id)
      .then((history) => { if (active) setMessages(history); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t("상담 기록을 불러오지 못했습니다.")); });
    if (readOnly) {
      setConnection(adminReadOnly ? "관리자 조회" : "기록 보기");
      return () => { active = false; };
    }
    const socket = io(SOCKET_URL, { auth: { staffToken: auth.accessToken }, transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", async () => {
      setConnection("연결됨");
      const joined = await socket.emitWithAck("chat:join", { sessionId: session.id });
      if (!joined?.ok) setError(joined?.error?.message ?? t("상담방 입장에 실패했습니다."));
    });
    socket.on("disconnect", () => setConnection("연결 끊김"));
    socket.io.on("reconnect_attempt", () => setConnection("재연결 중"));
    socket.on("chat:message", (message: MessageView) => setMessages((items) => mergeMessage(items, message)));
    socket.on("chat:message-accepted", (message: MessageView) => setMessages((items) => mergeMessage(items, message)));
    socket.on("chat:session-updated", (updated: SessionView) => {
      if (updated.id !== session.id) return;
      // 첫 Agent 메시지 저장과 함께 서버가 확정한 startedAt/expiresAt을 받아 같은 절대 시각으로 카운트다운을 시작합니다.
      setSession(updated);
      onChanged(updated);
    });
    socket.on("chat:session-closed", (updated: SessionView) => {
      if (updated.id === session.id) { setSession(updated); onChanged(updated); }
    });
    socket.on("chat:error", (payload: { message: string }) => setError(payload.message));
    return () => { active = false; socket.disconnect(); socketRef.current = null; };
  }, [adminReadOnly, auth.accessToken, readOnly, session.id, t]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto" }); }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || readOnly || session.status !== "ACTIVE" || !socketRef.current) return;
    setInput("");
    const result = await socketRef.current.emitWithAck("chat:message", { sessionId: session.id, clientMessageId: crypto.randomUUID(), content });
    if (!result?.ok) setError(result?.error?.message ?? t("메시지 전송에 실패했습니다."));
  }
  async function closeConversation() {
    try {
      const updated = await closeSession(auth.accessToken, session.id);
      setSession(updated);
      setShowCloseConfirm(false);
      onChanged(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("종료에 실패했습니다."));
    }
  }
  const writable =
    !readOnly &&
    session.status === "ACTIVE" &&
    (session.expiresAt === null ||
      new Date(session.expiresAt).getTime() > now);

  return (
    <section className="line-conversation-panel">
      <header className="line-conversation-header">
        <button className="line-mobile-back" onClick={onBack} aria-label={t("목록")}>‹</button>
        <span className="line-room-avatar">{session.room.roomNumber.slice(-2)}</span>
        <div className="line-conversation-identity">
          <h2>{session.room.hotel.name} · {session.room.roomNumber}{t("호")}</h2>
          <p>
            <span>{session.language.toUpperCase()} · {t(session.status)}</span>
            <span>{t("담당 상담원")}: <strong>{session.agent?.name ?? t("담당자 없음")}</strong></span>
            <span className={`line-connection ${connection === "연결됨" ? "ok" : ""}`}>● {t(connection)}</span>
          </p>
        </div>
        {/* 시간 다음에 종료 버튼을 두고 그룹 전체를 자동 여백으로 오른쪽 끝에 정렬합니다. */}
        <div className="line-conversation-actions">
          {session.status === "ACTIVE" && (
            <strong aria-label={t("채팅 만료 시간")}>
              {session.expiresAt
                ? remainingTime(session.expiresAt, now)
                : t("첫 답변 후 15분")}
            </strong>
          )}
          {writable && <button className="danger compact" onClick={() => setShowCloseConfirm(true)}>{t("상담 종료")}</button>}
        </div>
      </header>
      {/* 조건부 배너와 오류를 본문 안에 묶어도 헤더·본문·입력창의 세 행 구조가 변하지 않게 합니다. */}
      <div className="line-conversation-body">
        {readOnly && <div className="line-log-banner">{t(adminReadOnly ? "관리자 조회 모드입니다. 모든 상담을 읽을 수 있지만 메시지를 보내거나 담당자로 배정될 수 없습니다." : "종료된 상담 기록입니다. 모든 Agent가 읽을 수 있지만 메시지는 보낼 수 없습니다.")}</div>}
        {error && <div className="error-box line-chat-error">{error}</div>}
        <div className="line-chat-messages">
          {messages.length === 0 && <div className="empty">{t("아직 메시지가 없습니다.")}</div>}
          {messages.map((message) => (
            <article key={message.id} className={`line-bubble ${message.senderType === "AGENT" ? "mine" : message.senderType === "SYSTEM" ? "system" : "theirs"}`}>
              <small>{t(message.senderType === "SYSTEM" ? "호텔 안내" : message.senderType === "AGENT" ? "Agent" : "Guest")} · {new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</small>
              <p>{message.content}</p>
            </article>
          ))}
          <div ref={messageEndRef}/>
        </div>
      </div>
      <form className="line-chat-composer" onSubmit={send}>
        <span aria-hidden="true">＋</span>
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} disabled={!writable} placeholder={t(adminReadOnly ? "관리자 읽기 전용 조회입니다" : readOnly ? "종료된 상담 기록입니다" : "메시지를 입력하세요")}/>
        <button disabled={!writable || !input.trim()}>{t("전송")}</button>
      </form>
      {showCloseConfirm && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true"><h2>{t("상담을 종료할까요?")}</h2><p>{t("종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.")}</p><div><button className="secondary" onClick={() => setShowCloseConfirm(false)}>{t("취소")}</button><button className="danger" onClick={() => void closeConversation()}>{t("상담 종료")}</button></div></section></div>}
    </section>
  );
}

/** Agent 업무 화면을 LINE처럼 왼쪽 Current/Log 목록과 오른쪽 대화 본문으로 고정합니다. */
function LineAgentPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const { language, locale, t } = useI18n();
  const navigate = useNavigate();
  const isAdminView = auth.agent.role === "ADMIN";
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [mode, setMode] = useState<"current" | "log">("current");
  const [search, setSearch] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<AgentNotice | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() =>
    readNotificationSoundEnabled(),
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readAgentSidebarWidth(window.localStorage, window.innerWidth),
  );
  const knownWaitingIds = useRef<Set<string> | null>(null);
  const activeSessionsRef = useRef<Map<string, SessionView>>(new Map());
  const notificationSocketRef = useRef<Socket | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const titleFlasherRef = useRef<TitleFlasher | null>(null);
  const refreshInProgress = useRef(false);
  const sidebarResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    // 브라우저 폭이 줄어들면 저장된 큰 사이드바 너비를 즉시 줄여 대화 영역이 화면 밖으로 밀리지 않게 합니다.
    const fitSidebarToViewport = () =>
      setSidebarWidth((current) =>
        clampAgentSidebarWidth(current, window.innerWidth),
      );
    window.addEventListener("resize", fitSidebarToViewport);
    return () => window.removeEventListener("resize", fitSidebarToViewport);
  }, []);

  useEffect(() => {
    const flasher = createTitleFlasher(document, {
      setInterval: (handler, milliseconds) =>
        window.setInterval(handler, milliseconds),
      clearInterval: (id) => window.clearInterval(id),
    });
    titleFlasherRef.current = flasher;

    const stopWhenVisible = () => {
      if (document.visibilityState === "visible") flasher.stop();
    };
    const stopWhenFocused = () => flasher.stop();
    document.addEventListener("visibilitychange", stopWhenVisible);
    window.addEventListener("focus", stopWhenFocused);

    return () => {
      document.removeEventListener("visibilitychange", stopWhenVisible);
      window.removeEventListener("focus", stopWhenFocused);
      flasher.stop();
      titleFlasherRef.current = null;
    };
  }, []);

  function announce(nextNotice: AgentNotice): void {
    setNotice(nextNotice);
    if (soundEnabledRef.current) playNotificationSound();
    titleFlasherRef.current?.start(nextNotice.title);
    showSystemNotification(nextNotice.title, nextNotice.body, nextNotice.id);
  }

  async function refresh(): Promise<void> {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      const data = await listSessions(auth.accessToken);
      const newWaiting = findNewWaitingSessions(knownWaitingIds.current, data);
      knownWaitingIds.current = waitingSessionIds(data);
      const assignedActive = data.filter(
        (session) =>
          session.status === "ACTIVE" &&
          (isAdminView || session.agentId === auth.agent.id),
      );
      activeSessionsRef.current = new Map(
        assignedActive.map((session) => [session.id, session]),
      );
      if (notificationSocketRef.current?.connected) {
        assignedActive.forEach((session) =>
          notificationSocketRef.current?.emit("chat:join", {
            sessionId: session.id,
          }),
        );
      }
      setSessions(data);
      setError("");
      if (newWaiting.length > 0) {
        const first = newWaiting[0];
        const additional =
          newWaiting.length > 1
            ? language === "ja"
              ? ` · 他${newWaiting.length - 1}件`
              : ` · 외 ${newWaiting.length - 1}건`
            : "";
        announce({
          id: `waiting-${first.id}-${Date.now()}`,
          title: t("새 상담이 도착했습니다."),
          body: `${first.room.hotel.name} · ${first.room.roomNumber}${language === "ja" ? "号室" : "호"}${additional}`,
          actionLabel: t("대기 상담 보기"),
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("상담 목록을 불러오지 못했습니다."));
    } finally {
      refreshInProgress.current = false;
    }
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { staffToken: auth.accessToken }, transports: ["websocket"] });
    notificationSocketRef.current = socket;
    /** 수락·종료 이벤트의 실제 담당자 관계를 목록과 선택 상세에 같은 객체로 즉시 반영합니다. */
    const applyRealtimeSession = (updated: SessionView) => {
      setSessions((items) =>
        items.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                ...updated,
                lastMessage: updated.lastMessage ?? item.lastMessage,
              }
            : item,
        ),
      );
      setSelected((current) =>
        current?.id === updated.id ? { ...current, ...updated } : current,
      );
    };
    const joinAssignedSessions = () =>
      activeSessionsRef.current.forEach((session) =>
        socket.emit("chat:join", { sessionId: session.id }),
      );
    socket.on("connect", joinAssignedSessions);
    socket.on("chat:inbox-updated", () => void refresh());
    socket.on("chat:session-updated", applyRealtimeSession);
    socket.on("chat:session-closed", applyRealtimeSession);
    socket.on("chat:message", (message: MessageView) => {
      if (message.senderType !== "GUEST") return;
      const session = activeSessionsRef.current.get(message.sessionId);
      if (!session) return;
      setSessions((items) =>
        items.map((item) =>
          item.id === message.sessionId
            ? {
                ...item,
                lastActivityAt: message.createdAt,
                lastMessage: message,
              }
            : item,
        ),
      );
      announce({
        id: `message-${message.id}`,
        title: t("고객 메시지가 도착했습니다."),
        body: `${session.room.hotel.name} · ${session.room.roomNumber}${language === "ja" ? "号室" : "호"} · ${notificationPreview(message.content)}`,
      });
    });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
      notificationSocketRef.current = null;
    };
  }, [auth.accessToken, auth.agent.id, isAdminView, language, t]);

  const currentSessions = useMemo(
    () =>
      sortSessionsByRecentActivity(
        sessions.filter(
          (session) =>
            session.status === "WAITING" ||
            (session.status === "ACTIVE" &&
              (isAdminView || session.agentId === auth.agent.id)),
        ),
      ),
    [auth.agent.id, isAdminView, sessions],
  );
  const logSessions = useMemo(() => sessions.filter((session) => TERMINAL_SESSION_STATUSES.includes(session.status)), [sessions]);
  const hotels = useMemo(() => [...new Set(sessions.map((session) => session.room.hotel.name))].sort(), [sessions]);
  const languages = useMemo(
    () =>
      [...new Set(sessions.map((session) => session.language.trim().toLowerCase()))]
        .filter(Boolean)
        .sort(),
    [sessions],
  );
  const visibleSessions = filterAgentSessions(
    mode === "current" ? currentSessions : logSessions,
    { search, hotel: hotelFilter, language: languageFilter },
  );

  async function choose(session: SessionView) {
    try {
      // ADMIN은 전체 상담을 특별 조회만 하며 WAITING 상담을 자기 담당으로 가져오지 않습니다.
      if (isAdminView) {
        setSelected(session);
        return;
      }
      const opened = session.status === "WAITING" ? await openSession(auth.accessToken, session.id) : session;
      setSelected(opened);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("대화를 열지 못했습니다."));
      await refresh();
    }
  }
  async function enableBrowserNotifications(): Promise<void> {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setNotice({
        id: `permission-${Date.now()}`,
        title: t("브라우저 알림이 켜졌습니다."),
        body: t("탭이 백그라운드여도 새 상담과 메시지를 알려드립니다."),
      });
    }
  }
  function toggleNotificationSound(): void {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    saveNotificationSoundEnabled(enabled);
    if (enabled) playNotificationSound();
  }
  function showWaitingList(): void {
    setNotice(null);
    setMode("current");
    setSelected(null);
  }

  /** 구분선을 누른 시작 위치와 현재 너비를 기록해 포인터 이동량만큼 목록 폭을 변경합니다. */
  function startSidebarResize(
    event: React.PointerEvent<HTMLDivElement>,
  ): void {
    if (window.innerWidth <= 900) return;
    sidebarResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidthRef.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("line-sidebar-resizing");
  }

  /** 드래그 중에는 화면 경계와 대화 영역의 최소 폭을 고려한 값만 반영합니다. */
  function moveSidebarResize(
    event: React.PointerEvent<HTMLDivElement>,
  ): void {
    const resize = sidebarResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    const next = clampAgentSidebarWidth(
      resize.startWidth + event.clientX - resize.startX,
      window.innerWidth,
    );
    sidebarWidthRef.current = next;
    setSidebarWidth(next);
  }

  /** 드래그 종료값을 저장해 다음 로그인과 새로고침에서도 사용자가 정한 비율을 복원합니다. */
  function finishSidebarResize(
    event: React.PointerEvent<HTMLDivElement>,
  ): void {
    const resize = sidebarResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    sidebarResizeRef.current = null;
    document.body.classList.remove("line-sidebar-resizing");
    saveAgentSidebarWidth(window.localStorage, sidebarWidthRef.current);
  }

  /** 마우스를 사용할 수 없는 경우에도 방향키와 Home/End 키로 동일한 너비 조절이 가능합니다. */
  function resizeSidebarWithKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    const keyWidth =
      event.key === "Home"
        ? AGENT_SIDEBAR_MIN_WIDTH
        : event.key === "End"
          ? AGENT_SIDEBAR_MAX_WIDTH
          : event.key === "ArrowLeft"
            ? sidebarWidthRef.current - 16
            : event.key === "ArrowRight"
              ? sidebarWidthRef.current + 16
              : null;
    if (keyWidth === null) return;
    event.preventDefault();
    const next = clampAgentSidebarWidth(keyWidth, window.innerWidth);
    sidebarWidthRef.current = next;
    setSidebarWidth(next);
    saveAgentSidebarWidth(window.localStorage, next);
  }

  function logout() { clearStoredAuth(auth.agent.role); location.href = "/login"; }
  /** 종료·만료 상태를 현재 본문에 반영하되 상담원이 직접 Log를 누르기 전에는 탭을 바꾸지 않습니다. */
  function updateSelectedConversation(updated: SessionView): void {
    setSelected(updated);
    void refresh();
  }
  const notificationButtonLabel =
    notificationPermission === "unsupported"
      ? t("브라우저 알림 미지원")
      : notificationPermission === "granted"
      ? t("브라우저 알림 켜짐")
      : notificationPermission === "denied"
        ? t("브라우저 알림 차단됨")
        : t("브라우저 알림 켜기");

  return (
    <div className="line-agent-shell">
      {/* 상담 목록 폭과 관계없이 공통 메뉴가 화면 전체 너비를 사용하도록 업무 영역 바깥에 둡니다. */}
      <header className="line-agent-topbar">
        <div className="agent-brand">REMOTE<span>+</span></div>
        {isAdminView && (
          <button
            className="line-agent-admin-link secondary"
            onClick={() => navigate(ADMIN_DASHBOARD_PATH)}
          >
            {t("관리자 페이지")}
          </button>
        )}
        {/* DOM 순서를 화면 요구사항과 같게 두어 사용자 정보가 오른쪽 설정 메뉴의 첫 항목이 되게 합니다. */}
        <div className="line-agent-topbar-actions">
          <div
            className="line-agent-account"
            aria-label={`${t("로그인 계정")}: ${auth.agent.name}`}
            title={auth.agent.name}
          >
            {/* 사용자 정보 안에서는 프로필 아이콘 다음에 상담원 이름을 표시합니다. */}
            <span aria-hidden="true">{auth.agent.name.slice(0, 1).toUpperCase()}</span>
            <strong>{auth.agent.name}</strong>
          </div>
          <LanguageSwitcher/>
          <div className="line-agent-controls">
            <button className="link-button" aria-pressed={soundEnabled} onClick={toggleNotificationSound}>
              <span className="line-agent-control-icon" aria-hidden="true">{soundEnabled ? "🔇" : "🔊"}</span>
              <span className="line-agent-control-label">{t(soundEnabled ? "알림음 끄기" : "알림음 켜기")}</span>
            </button>
            <button className="link-button" disabled={notificationPermission !== "default"} onClick={() => void enableBrowserNotifications()}>
              <span className="line-agent-control-icon" aria-hidden="true">♢</span>
              <span className="line-agent-control-label">{notificationButtonLabel}</span>
            </button>
            <button className="link-button" onClick={() => setShowPasswordChange(true)}>
              <span className="line-agent-control-icon" aria-hidden="true">🔑</span>
              <span className="line-agent-control-label">{t("비밀번호 변경")}</span>
            </button>
            <button className="link-button" onClick={logout}>
              <span className="line-agent-control-icon" aria-hidden="true">↪</span>
              <span className="line-agent-control-label">{t("로그아웃")}</span>
            </button>
          </div>
        </div>
      </header>
      <div
        className={`line-agent-workspace ${selected ? "has-selection" : ""}`}
        style={{
          gridTemplateColumns: `${sidebarWidth}px 8px minmax(0, 1fr)`,
        }}
      >
        <aside className="line-agent-list">
          {/* 공통 사용자 메뉴를 제거해 상담 탭부터 목록 영역이 바로 시작됩니다. */}
          <div className="line-inbox-tabs">
            <button className={mode === "current" ? "active" : ""} onClick={() => { setMode("current"); setSelected(null); }}>{t("Current chat room")} <em>{currentSessions.length}</em></button>
            <button className={mode === "log" ? "active" : ""} onClick={() => { setMode("log"); setSelected(null); }}>{t("Log")} <em>{logSessions.length}</em></button>
          </div>
          <label className="line-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("대화방, 메시지 검색")}/></label>
          <div className="line-filters">
            <select value={hotelFilter} onChange={(event) => setHotelFilter(event.target.value)} aria-label={t("호텔 필터")}><option value="">{t("전체 호텔")}</option>{hotels.map((hotel) => <option key={hotel}>{hotel}</option>)}</select>
            <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} aria-label={t("언어 필터")}><option value="">{t("전체 언어")}</option>{languages.map((language) => <option key={language} value={language}>{language.toUpperCase()}</option>)}</select>
            <button onClick={() => void refresh()} aria-label={t("새로고침")}>↻</button>
          </div>
          {error && <div className="error-box line-inbox-error">{error}</div>}
          <div className="line-conversation-list">
            {visibleSessions.length === 0 && <div className="line-empty"><span>{mode === "current" ? "✓" : "⌁"}</span><strong>{t(mode === "current" ? "현재 상담이 없습니다." : "조건에 맞는 기록이 없습니다.")}</strong></div>}
            {visibleSessions.map((session) => (
              <button key={session.id} className={`line-conversation-item ${selected?.id === session.id ? "selected" : ""}`} onClick={() => void choose(session)}>
                <span className="line-room-avatar">{session.room.roomNumber.slice(-2)}</span>
                <span><strong>{session.room.hotel.name} · {session.room.roomNumber}{t("호")}</strong><small>{session.lastMessage?.content ?? t(session.status === "WAITING" ? "새 문의가 도착했습니다." : session.status)}</small><em>{session.language.toUpperCase()} · {t("담당 상담원")}: {session.agent?.name ?? t("담당자 없음")}</em></span>
                <time>{new Date(session.lastMessage?.createdAt ?? session.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</time>
              </button>
            ))}
          </div>
        </aside>
        <div
          className="line-sidebar-resizer"
          role="separator"
          aria-label={t("목록과 대화창 너비 조절")}
          aria-orientation="vertical"
          aria-valuemin={AGENT_SIDEBAR_MIN_WIDTH}
          aria-valuemax={AGENT_SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={startSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={finishSidebarResize}
          onPointerCancel={finishSidebarResize}
          onKeyDown={resizeSidebarWithKeyboard}
        />
        {selected ? <LineConversationPanel auth={auth} initial={selected} readOnly={isAdminView || mode === "log" || TERMINAL_SESSION_STATUSES.includes(selected.status)} adminReadOnly={isAdminView} onBack={() => setSelected(null)} onChanged={updateSelectedConversation}/> : <section className="line-conversation-placeholder"><h2>{t(mode === "current" ? "대화를 선택하세요" : "상담 기록을 선택하세요")}</h2><p>{t(isAdminView ? "관리자는 전체 상담을 읽기 전용으로 조회할 수 있습니다." : mode === "current" ? "왼쪽 목록에서 Guest 문의를 열면 상담이 시작됩니다." : "모든 Agent의 종료 상담을 읽기 전용으로 확인할 수 있습니다.")}</p></section>}
        {notice && <AgentNoticePopup notice={notice} onClose={() => setNotice(null)} onAction={showWaitingList}/>}
        {showPasswordChange && <PasswordChangeModal auth={auth} onClose={() => setShowPasswordChange(false)}/>}
      </div>
    </div>
  );
}

/** 상담 목록은 폴링으로 새 대기 상담을 찾고 Socket.IO로 담당 상담의 고객 메시지를 즉시 알립니다. */
function AgentPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const { language, t } = useI18n();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [selected, setSelected] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<AgentNotice | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() =>
    readNotificationSoundEnabled(),
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const knownWaitingIds = useRef<Set<string> | null>(null);
  const activeSessionsRef = useRef<Map<string, SessionView>>(new Map());
  const notificationSocketRef = useRef<Socket | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const titleFlasherRef = useRef<TitleFlasher | null>(null);
  const refreshInProgress = useRef(false);
  const listScrollPosition = useRef(0);

  useEffect(() => {
    const flasher = createTitleFlasher(document, {
      setInterval: (handler, milliseconds) =>
        window.setInterval(handler, milliseconds),
      clearInterval: (id) => window.clearInterval(id),
    });
    titleFlasherRef.current = flasher;
    // 탭을 다시 보거나 브라우저 창으로 돌아오면 새 채팅을 확인한 것으로 보고 제목을 즉시 복구합니다.
    const stopWhenVisible = () => {
      if (document.visibilityState === "visible") flasher.stop();
    };
    const stopWhenFocused = () => flasher.stop();
    document.addEventListener("visibilitychange", stopWhenVisible);
    window.addEventListener("focus", stopWhenFocused);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenVisible);
      window.removeEventListener("focus", stopWhenFocused);
      flasher.stop();
      titleFlasherRef.current = null;
    };
  }, []);

  function announce(nextNotice: AgentNotice): void {
    setNotice(nextNotice);
    if (soundEnabledRef.current) playNotificationSound();
    titleFlasherRef.current?.start(nextNotice.title);
    showSystemNotification(nextNotice.title, nextNotice.body, nextNotice.id);
  }

  async function refresh(): Promise<void> {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      const data = await listSessions(auth.accessToken);
      const newWaiting = findNewWaitingSessions(knownWaitingIds.current, data);
      knownWaitingIds.current = waitingSessionIds(data);

      // 이 Agent에게 배정된 진행 상담은 전역 알림 소켓도 입장해 다른 상담을 보고 있을 때의 고객 메시지를 놓치지 않습니다.
      const assignedActive = data.filter(
        (item) => item.status === "ACTIVE" && item.agentId === auth.agent.id,
      );
      activeSessionsRef.current = new Map(
        assignedActive.map((item) => [item.id, item]),
      );
      if (notificationSocketRef.current?.connected) {
        assignedActive.forEach((item) =>
          notificationSocketRef.current?.emit("chat:join", {
            sessionId: item.id,
          }),
        );
      }

      setSessions(data);
      setError("");
      if (newWaiting.length > 0) {
        const first = newWaiting[0];
        const additional =
          newWaiting.length > 1
            ? language === "ja"
              ? ` · ほか${newWaiting.length - 1}件`
              : ` · 외 ${newWaiting.length - 1}건`
            : "";
        announce({
          id: `waiting-${first.id}-${Date.now()}`,
          title: t("새 상담이 도착했습니다."),
          body: `${first.room.hotel.name} · ${first.room.roomNumber}${language === "ja" ? "号室" : "호"}${additional}`,
          actionLabel: t("대기 상담 보기"),
        });
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "상담 목록을 불러오지 못했습니다.",
      );
    } finally {
      refreshInProgress.current = false;
    }
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { staffToken: auth.accessToken },
      transports: ["websocket"],
    });
    notificationSocketRef.current = socket;
    const joinAssignedSessions = () =>
      activeSessionsRef.current.forEach((session) =>
        socket.emit("chat:join", { sessionId: session.id }),
      );
    socket.on("connect", joinAssignedSessions);
    socket.on("chat:message", (message: MessageView) => {
      if (message.senderType !== "GUEST") return;
      const session = activeSessionsRef.current.get(message.sessionId);
      if (!session) return;
      // REST 폴링을 기다리지 않고 수신 즉시 최근 활동 시각을 갱신해 새 메시지 상담을 목록 맨 위로 이동합니다.
      setSessions((items) =>
        items.map((item) =>
          item.id === message.sessionId
            ? { ...item, lastActivityAt: message.createdAt }
            : item,
        ),
      );
      announce({
        id: `message-${message.id}`,
        title: t("고객 메시지가 도착했습니다."),
        body: `${session.room.hotel.name} · ${session.room.roomNumber}${language === "ja" ? "号室" : "호"} · ${notificationPreview(message.content)}`,
      });
    });
    return () => {
      socket.disconnect();
      notificationSocketRef.current = null;
    };
  }, [auth.accessToken, language, t]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [auth.accessToken, auth.agent.id, language, t]);

  const waiting = useMemo(
    () => sessions.filter((item) => item.status === "WAITING"),
    [sessions],
  );
  const active = useMemo(
    () =>
      sortSessionsByRecentActivity(
        sessions.filter(
          (item) => item.status === "ACTIVE" && item.agentId === auth.agent.id,
        ),
      ),
    [sessions, auth.agent.id],
  );
  const conversationLogs = useMemo(
    () => filterConversationLogs(sessions, ""),
    [sessions],
  );

  function backToList(): void {
    setSelected(null);
    void refresh();
    // 채팅에서 목록으로 돌아올 때 상담을 열기 전 위치를 복원해 긴 목록의 맨 위로 튀지 않게 합니다.
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: listScrollPosition.current, behavior: "auto" }),
    );
  }

  function showWaitingList(): void {
    setNotice(null);
    setSelected(null);
    window.requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  async function enableBrowserNotifications(): Promise<void> {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setNotice({
        id: `permission-${Date.now()}`,
        title: t("브라우저 알림이 켜졌습니다."),
        body: t("탭이 백그라운드여도 새 상담과 메시지를 알려드립니다."),
      });
    }
  }

  /** 알림음은 기본으로 끄고, 상담원이 직접 켠 경우에만 이후 상담·메시지 알림에서 재생합니다. */
  function toggleNotificationSound(): void {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    saveNotificationSoundEnabled(enabled);
    // 켜기 버튼을 누른 사용자 동작 안에서 시험음을 재생해 브라우저 자동재생 정책을 만족하고 설정 결과를 확인시킵니다.
    if (enabled) playNotificationSound();
  }

  if (selected)
    return (
      <>
        <AgentChat
          auth={auth}
          initial={selected}
          onBack={backToList}
          onChanged={() => void refresh()}
        />
        {notice && (
          <AgentNoticePopup
            notice={notice}
            onClose={() => setNotice(null)}
            onAction={showWaitingList}
          />
        )}
      </>
    );

  function open(session: SessionView): void {
    listScrollPosition.current = window.scrollY;
    setSelected(session);
  }
  async function accept(session: SessionView): Promise<void> {
    listScrollPosition.current = window.scrollY;
    try {
      setSelected(await acceptSession(auth.accessToken, session.id));
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "상담 수락에 실패했습니다.",
      );
      await refresh();
    }
  }

  const notificationButtonLabel =
    notificationPermission === "granted"
      ? t("브라우저 알림 켜짐")
      : notificationPermission === "denied"
        ? t("브라우저 알림 차단됨")
        : t("브라우저 알림 켜기");
  return (
    <>
      <Page
        auth={auth}
        title={t("Agent 상담 센터")}
        subtitle={t("대기 중인 상담을 확인하고 응답합니다.")}
      >
        <div className="stats">
          <article>
            <span>{t("대기")}</span>
            <strong>{waiting.length}</strong>
          </article>
          <article>
            <span>{t("내 진행")}</span>
            <strong>{active.length}</strong>
          </article>
          <article>
            <span>{t("전체 로그")}</span>
            <strong>{conversationLogs.length}</strong>
          </article>
        </div>
        {error && <div className="error-box">{error}</div>}
        <section className="card">
          <div className="section-head">
            <div>
              <h2>{t("대기 상담")}</h2>
              <p>{t("오래 기다린 상담부터 확인하세요.")}</p>
            </div>
            <div className="section-actions">
              <button
                type="button"
                className="secondary"
                aria-pressed={soundEnabled}
                onClick={toggleNotificationSound}
              >
                {t(soundEnabled ? "알림음 끄기" : "알림음 켜기")}
              </button>
              {notificationPermission !== "unsupported" && (
                <button
                  type="button"
                  className="secondary"
                  disabled={notificationPermission !== "default"}
                  onClick={() => void enableBrowserNotifications()}
                >
                  {notificationButtonLabel}
                </button>
              )}
              <button onClick={() => void refresh()}>{t("새로고침")}</button>
            </div>
          </div>
          <SessionTable
            items={waiting}
            action={(session) => (
              <button onClick={() => void accept(session)}>
                {t("상담 수락")}
              </button>
            )}
          />
        </section>
        <section className="card">
          <div className="section-head">
            <div>
              <h2>{t("내 진행 상담")}</h2>
              <p>{t("현재 담당 중인 상담입니다.")}</p>
            </div>
          </div>
          <SessionTable
            items={active}
            action={(session) => (
              <button onClick={() => open(session)}>{t("상담 열기")}</button>
            )}
          />
        </section>
        <ConversationLogBlock sessions={sessions} onOpen={open} />
      </Page>
      {notice && (
        <AgentNoticePopup
          notice={notice}
          onClose={() => setNotice(null)}
          onAction={showWaitingList}
        />
      )}
    </>
  );
}

/** 상담 목록의 공통 열을 한 컴포넌트로 관리해 상태별 표가 서로 달라지지 않게 합니다. */
function SessionTable({
  items,
  action,
}: {
  items: SessionView[];
  action: (session: SessionView) => React.ReactNode;
}): React.JSX.Element {
  const { locale, t } = useI18n();
  // 모바일에서는 data-label을 행 카드의 항목명으로 표시해 가로 스크롤 없이 상담 핵심 정보를 읽을 수 있게 합니다.
  return (
    <div className="table-wrap session-table">
      <table>
        <thead>
          <tr>
            <th>{t("호텔")}</th>
            <th>{t("객실")}</th>
            <th>{t("언어")}</th>
            <th>{t("상태")}</th>
            <th>{t("만료 시각")}</th>
            <th>{t("작업")}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr className="empty-row">
              <td colSpan={6} className="empty">
                {t("표시할 상담이 없습니다.")}
              </td>
            </tr>
          ) : (
            items.map((session) => (
              <tr key={session.id}>
                <td data-label={t("호텔")}>{session.room.hotel.name}</td>
                <td data-label={t("객실")}>{session.room.roomNumber}</td>
                <td data-label={t("언어")}>{session.language.toUpperCase()}</td>
                <td data-label={t("상태")}>
                  <span className={`badge ${session.status.toLowerCase()}`}>
                    {session.status}
                  </span>
                </td>
                <td data-label={t("만료 시각")}>
                  {session.expiresAt ? new Date(session.expiresAt).toLocaleTimeString(locale) : t("대기 중")}
                </td>
                <td data-label={t("작업")}>{action(session)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Agent와 관리자가 같은 형식으로 모든 완료 상담을 호텔별로 필터링해 확인하는 공용 로그 블록입니다. */
function ConversationLogBlock({
  sessions,
  onOpen,
  embedded = false,
}: {
  sessions: SessionView[];
  onOpen: (session: SessionView) => void;
  embedded?: boolean;
}): React.JSX.Element {
  const { t } = useI18n();
  const [hotelId, setHotelId] = useState("");
  const hotels = useMemo(
    () =>
      Array.from(
        new Map(
          sessions.map((session) => [
            session.room.hotel.id,
            session.room.hotel,
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [sessions],
  );
  const logs = useMemo(
    () => filterConversationLogs(sessions, hotelId),
    [hotelId, sessions],
  );

  return (
    <section className={embedded ? "conversation-log-card embedded" : "card conversation-log-card"}>
      <div className="section-head">
        {!embedded && (
          <div>
            <h2>{t("전체 상담 로그")}</h2>
            <p>{t("모든 Agent의 종료·만료 상담을 함께 확인합니다.")}</p>
          </div>
        )}
        <label className="filter compact-filter">
          {t("호텔 필터")}
          <select
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
          >
            <option value="">{t("전체 호텔")}</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="conversation-log-scroll">
        <SessionTable
          items={logs}
          action={(session) => (
            <button onClick={() => onOpen(session)}>{t("기록 보기")}</button>
          )}
        />
      </div>
    </section>
  );
}

/** 관리자 로그 상세는 읽기 전용 모달로 제공해 관리 화면을 떠나지 않고 전체 메시지를 확인하게 합니다. */
function ConversationLogModal({
  auth,
  session,
  onClose,
}: {
  auth: AgentAuth;
  session: SessionView;
  onClose: () => void;
}): React.JSX.Element {
  const { locale, t } = useI18n();
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getMessages(auth.accessToken, session.id)
      .then((items) => {
        if (active) setMessages(items);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : t("상담 기록을 불러오지 못했습니다."),
          );
      });
    return () => {
      active = false;
    };
  }, [auth.accessToken, session.id, t]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="log-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-modal-title"
      >
        <div className="qr-modal-heading">
          <div>
            <span>{t("전체 상담 로그")}</span>
            <h2 id="log-modal-title">
              {session.room.hotel.name} · {session.room.roomNumber}
            </h2>
          </div>
          <button
            type="button"
            className="link-button qr-close"
            aria-label={t("닫기")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="log-messages">
          {messages.length === 0 && !error ? (
            <div className="empty">{t("아직 메시지가 없습니다.")}</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`bubble ${message.senderType === "AGENT" ? "mine" : "theirs"}`}
              >
                <small>
                  {t(message.senderType === "AGENT" ? "Agent" : "투숙객")} ·{" "}
                  {new Date(message.createdAt).toLocaleString(locale)}
                </small>
                <p>{message.content}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/** 사용자가 알림음을 켠 경우에만 짧은 시험·수신음을 재생하고 완료 뒤 오디오 자원을 해제합니다. */
function playNotificationSound(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    oscillator.connect(context.destination);
    oscillator.frequency.value = 880;
    oscillator.onended = () => void context.close();
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {
    /* 소리가 차단되어도 화면 팝업은 항상 유지됩니다. */
  }
}

/** 비밀번호 노출 여부를 아이콘 하나로 전달해 모든 비밀번호 입력칸에서 같은 의미를 사용합니다. */
function PasswordVisibilityIcon({
  hidden,
}: {
  hidden: boolean;
}): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      {hidden && <path d="m4 4 16 16" />}
    </svg>
  );
}

/** 각 비밀번호 칸이 자기 표시 상태를 독립 관리해 다른 비밀번호가 함께 노출되지 않게 합니다. */
function PasswordField({
  label,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-input-wrap">
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <button
          type="button"
          className="password-visibility"
          aria-label={t(visible ? "비밀번호 숨기기" : "비밀번호 보기")}
          title={t(visible ? "비밀번호 숨기기" : "비밀번호 보기")}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <PasswordVisibilityIcon hidden={visible} />
        </button>
      </span>
    </label>
  );
}

/** 현재 비밀번호를 다시 확인한 뒤 새 비밀번호로 바꾸고, 성공하면 폐기된 토큰을 남기지 않도록 재로그인시킵니다. */
function PasswordChangeModal({ auth, onClose }: { auth: AgentAuth; onClose: () => void }): React.JSX.Element {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault(); setError("");
    if (newPassword !== confirmation) { setError(t("새 비밀번호가 서로 일치하지 않습니다.")); return; }
    setLoading(true);
    try {
      await changeStaffPassword(auth.accessToken, currentPassword, newPassword);
      clearStoredAuth("ADMIN"); clearStoredAuth("AGENT");
      window.alert(t("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인하세요."));
      location.href = "/login";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("비밀번호를 변경하지 못했습니다."));
    } finally { setLoading(false); }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        className="confirm-modal password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
      >
        <h2 id="password-title">{t("비밀번호 변경")}</h2>
        <p>
          {t(
            "변경하면 이 계정으로 로그인한 모든 기기에서 다시 로그인해야 합니다.",
          )}
        </p>
        <form className="password-form" onSubmit={submit}>
          <PasswordField
            label={t("현재 비밀번호")}
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
          <PasswordField
            label={t("새 비밀번호")}
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            label={t("새 비밀번호 확인")}
            autoComplete="new-password"
            value={confirmation}
            onChange={setConfirmation}
          />
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div>
            <button
              type="button"
              className="secondary"
              disabled={loading}
              onClick={onClose}
            >
              {t("취소")}
            </button>
            <button disabled={loading}>
              {t(loading ? "변경 중…" : "비밀번호 변경")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** 관리자만 받은 투숙객 주소를 클립보드에 복사합니다. 실패하면 호출부가 화면 오류로 안내합니다. */
async function copyGuestUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}

/**
 * 선택한 객실 고객 URL을 고정 QR로 미리 보고 PNG로 내려받습니다.
 * 이미지는 브라우저 메모리에서만 생성해 접근키가 포함된 URL을 별도 서버나 저장소로 전송하지 않습니다.
 */
function RoomQrModal({
  room,
  onClose,
}: {
  room: RoomView;
  onClose: () => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setDataUrl("");
    setError("");

    /** 비동기 생성 도중 모달이 닫혀도 이미 사라진 컴포넌트의 상태를 갱신하지 않습니다. */
    if (room.guestUrl) {
      void createRoomQrDataUrl(room.guestUrl)
        .then((value) => {
          if (active) setDataUrl(value);
        })
        .catch(() => {
          if (active) setError(t("QR 코드를 만들 수 없습니다."));
        });
    } else {
      setError(t("QR 코드를 만들 수 없습니다."));
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      active = false;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, room.guestUrl, t]);

  function download(): void {
    if (!dataUrl) return;
    downloadRoomQr(
      dataUrl,
      createRoomQrFileName(room.hotel.name, room.roomNumber),
    );
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-qr-title"
      >
        <div className="qr-modal-heading">
          <div>
            <span>{t("고정 QR 안내")}</span>
            <h2 id="room-qr-title">
              {room.hotel.name} {room.roomNumber} · {t("객실 고정 QR")}
            </h2>
          </div>
          <button
            type="button"
            className="link-button qr-close"
            aria-label={t("닫기")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="qr-preview" aria-live="polite">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`${room.hotel.name} ${room.roomNumber} ${t("객실 고정 QR")}`}
            />
          ) : error ? (
            <div className="error-box">{error}</div>
          ) : (
            <div className="qr-loading">{t("QR 생성 중…")}</div>
          )}
        </div>
        <p className="qr-permanent-note">
          <strong>
            {t(
              "이 QR은 객실에 인쇄하여 비치하는 고정 QR이며 정기 갱신되지 않습니다.",
            )}
          </strong>
          <br />
          {t(
            "인쇄 전에 운영 고객 도메인을 확정하고 실제 휴대전화로 스캔을 시험하세요.",
          )}
          <br />
          {t(
            "권장 인쇄 크기는 가로·세로 3cm 이상이며 QR 주변 흰 여백을 자르지 마세요.",
          )}
        </p>
        {room.guestUrl && (
          <a
            className="qr-url"
            href={room.guestUrl}
            target="_blank"
            rel="noreferrer"
          >
            {room.guestUrl}
          </a>
        )}
        <a
          className="qr-license"
          href="/third-party-notices.txt"
          target="_blank"
          rel="noreferrer"
        >
          {t("오픈소스 라이선스 고지")}
        </a>
        <div className="qr-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t("닫기")}
          </button>
          <button type="button" disabled={!dataUrl} onClick={download}>
            {t("PNG 다운로드")}
          </button>
        </div>
      </section>
    </div>
  );
}

/** 관리자 화면은 Agent·호텔·룸 CRUD, 고객 주소와 객실별 고정 QR 관리를 제공합니다. */
function AdminPage({ auth }: { auth: AgentAuth }): React.JSX.Element {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AdminAgentView[]>([]);
  const [hotels, setHotels] = useState<HotelView[]>([]);
  const [rooms, setRooms] = useState<RoomView[]>([]);
  // null은 API에 hotelId를 보내지 않는 "접근 가능한 전체 호텔"이며 실제 호텔 ID와 겹치지 않습니다.
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [agentForm, setAgentForm] = useState({
    name: "",
    loginId: "",
    password: "",
  });
  const [hotelName, setHotelName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomHotelId, setRoomHotelId] = useState("");
  const [hotelError, setHotelError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [qrRoom, setQrRoom] = useState<RoomView | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [welcomeLanguage, setWelcomeLanguage] = useState<"ja" | "en">("ja");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomeError, setWelcomeError] = useState("");
  const [welcomeSaved, setWelcomeSaved] = useState("");
  const [activeAdminSection, setActiveAdminSection] = useState<
    "hotels" | "agents"
  >("hotels");
  const [adminMenuCollapsed, setAdminMenuCollapsed] = useState(
    () => window.localStorage.getItem("remoteplus-admin-menu-collapsed") === "true",
  );

  /** 넓은 화면에서 관리 메뉴 폭을 줄인 선택을 같은 브라우저에 기억합니다. */
  function toggleAdminMenu(): void {
    setAdminMenuCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(
        "remoteplus-admin-menu-collapsed",
        String(next),
      );
      return next;
    });
  }

  async function refresh() {
    try {
      const [a, h, r] = await Promise.all([
        listAdminAgents(auth.accessToken),
        listHotels(auth.accessToken),
        // 전체 호텔은 undefined로 호출해 "all" 같은 가짜 ID가 서버에 전달되지 않게 합니다.
        listRooms(auth.accessToken, selectedHotelId ?? undefined),
      ]);
      setAgents(a);
      setHotels(h);
      setRooms(r);
      setRoomHotelId((current) =>
        h.some((hotel) => hotel.id === current) ? current : (h[0]?.id ?? ""),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "관리 데이터를 불러오지 못했습니다.",
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, [selectedHotelId]);
  useEffect(() => {
    const hotel = hotels.find((item) => item.id === roomHotelId);
    setWelcomeMessage(hotel ? (welcomeLanguage === "en" ? hotel.welcomeMessageEn : hotel.welcomeMessage) : "");
    setWelcomeError("");
    setWelcomeSaved("");
  }, [hotels, roomHotelId, welcomeLanguage]);
  async function addAgent(e: FormEvent) {
    e.preventDefault();
    try {
      await createAdminAgent(auth.accessToken, agentForm);
      setAgentForm({ name: "", loginId: "", password: "" });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent 추가 실패");
    }
  }
  /** 호텔 생성 오류는 호텔 입력 블록에만 표시해 어느 요청이 실패했는지 즉시 알 수 있게 합니다. */
  async function addHotel(e: FormEvent) {
    e.preventDefault();
    setHotelError("");
    try {
      await createHotel(auth.accessToken, hotelName);
      setHotelName("");
      await refresh();
    } catch (reason) {
      setHotelError(
        reason instanceof Error ? reason.message : "호텔 추가 실패",
      );
    }
  }
  /** 객실 중복 등 룸 생성 오류는 룸 입력 블록 바로 위에 표시하고 다른 관리자 오류와 섞지 않습니다. */
  async function addRoom(e: FormEvent) {
    e.preventDefault();
    setRoomError("");
    try {
      await createRoom(auth.accessToken, roomHotelId, roomNumber);
      setRoomNumber("");
      await refresh();
    } catch (reason) {
      setRoomError(reason instanceof Error ? reason.message : "룸 추가 실패");
    }
  }
  /** 언어별 원문을 저장하고 이미 생성된 상담 기록은 변경하지 않은 채 다음 신규 상담부터 적용합니다. */
  async function saveWelcomeMessage(event: FormEvent) {
    event.preventDefault();
    setWelcomeError("");
    setWelcomeSaved("");
    try {
      await updateHotelWelcomeMessage(auth.accessToken, roomHotelId, welcomeLanguage, welcomeMessage);
      setWelcomeSaved(t("자동 안내문을 저장했습니다. 다음 신규 상담부터 적용됩니다."));
      await refresh();
    } catch (reason) {
      setWelcomeError(reason instanceof Error ? reason.message : t("자동 안내문 저장 실패"));
    }
  }
  /** 삭제 전 영향을 명확히 알리고 확인받아 실수로 운영 데이터를 제거하는 일을 줄입니다. */
  async function removeAgent(agent: AdminAgentView) {
    const message =
      language === "ja"
        ? `${agent.name}（${agent.loginId}）Agentを削除しますか？既存の相談履歴は保持されます。`
        : `${agent.name} (${agent.loginId}) Agent를 삭제할까요? 기존 상담 기록은 유지됩니다.`;
    if (!window.confirm(message)) return;
    try {
      await deleteAdminAgent(auth.accessToken, agent.id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Agent 삭제 실패");
    }
  }
  async function removeHotel(hotel: HotelView) {
    const message =
      language === "ja"
        ? `${hotel.name}を削除しますか？配下の客室とすべての相談・メッセージも削除され、元に戻せません。`
        : `${hotel.name} 호텔을 삭제할까요? 하위 룸과 모든 상담·메시지도 함께 삭제되며 복구할 수 없습니다.`;
    if (!window.confirm(message)) return;
    try {
      await deleteHotel(auth.accessToken, hotel.id);
      if (selectedHotelId === hotel.id) setSelectedHotelId(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "호텔 삭제 실패");
    }
  }
  async function removeRoom(room: RoomView) {
    const message =
      language === "ja"
        ? `${room.hotel.name} ${room.roomNumber}号室を削除しますか？アクセスキーと相談・メッセージも削除され、元に戻せません。`
        : `${room.hotel.name} ${room.roomNumber} 룸을 삭제할까요? 접근키와 상담·메시지도 함께 삭제되며 복구할 수 없습니다.`;
    if (!window.confirm(message)) return;
    try {
      await deleteRoom(auth.accessToken, room.id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "룸 삭제 실패");
    }
  }
  function logout() {
    clearStoredAuth("ADMIN");
    location.href = "/login";
  }
  const selectedHotel = hotels.find((hotel) => hotel.id === roomHotelId);
  return (
    <div className="admin-shell">
      <header>
        <div className="admin-heading">
          <div className="admin-brand-row">
            <div className="brand dark">
              REMOTE<span>+</span>
            </div>
            <button
              className="secondary admin-agent-link"
              onClick={() => navigate(ADMIN_AGENT_WORKSPACE_PATH)}
            >
              {t("Agent 페이지")}
            </button>
          </div>
          <h1>{t("관리자 페이지")}</h1>
        </div>
        <div className="admin-header-actions">
          <LanguageSwitcher />
          <button
            className="secondary"
            onClick={() => setShowPasswordChange(true)}
          >
            {t("비밀번호 변경")}
          </button>
          <button className="secondary" onClick={logout}>
            {t("로그아웃")}
          </button>
        </div>
      </header>
      {error && <div className="error-box">{error}</div>}
      <section className="admin-stats" aria-label={t("운영 현황")}>
        <article><span>A</span><div><small>{t("등록 Agent")}</small><strong>{agents.length}</strong></div></article>
        <article><span>H</span><div><small>{t("운영 호텔")}</small><strong>{hotels.length}</strong></div></article>
        <article><span>R</span><div><small>{t("등록 룸")}</small><strong>{rooms.length}</strong></div></article>
        <article><span>↗</span><div><small>{t("Guest 주소")}</small><strong>{rooms.filter((room) => room.guestUrl).length}</strong></div></article>
      </section>
      <div className={`admin-dashboard${adminMenuCollapsed ? " menu-collapsed" : ""}`}>
        <aside className="admin-navigation" aria-label={t("관리 메뉴")}>
          <div className="admin-navigation-heading">
            <span>{t("관리 메뉴")}</span>
            <button
              type="button"
              aria-label={t(adminMenuCollapsed ? "메뉴 펼치기" : "메뉴 접기")}
              title={t(adminMenuCollapsed ? "메뉴 펼치기" : "메뉴 접기")}
              aria-expanded={!adminMenuCollapsed}
              onClick={toggleAdminMenu}
            >
              {adminMenuCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav>
            <button
              type="button"
              className={activeAdminSection === "hotels" ? "active" : ""}
              aria-current={activeAdminSection === "hotels" ? "page" : undefined}
              onClick={() => setActiveAdminSection("hotels")}
            >
              <span className="admin-nav-icon" aria-hidden="true">H</span>
              <span className="admin-nav-copy">
                <strong>{t("호텔 관리")}</strong>
                <small>{t("호텔·객실·안내문")}</small>
              </span>
              <em>{hotels.length}</em>
            </button>
            <button
              type="button"
              className={activeAdminSection === "agents" ? "active" : ""}
              aria-current={activeAdminSection === "agents" ? "page" : undefined}
              onClick={() => setActiveAdminSection("agents")}
            >
              <span className="admin-nav-icon" aria-hidden="true">A</span>
              <span className="admin-nav-copy">
                <strong>{t("Agent 관리")}</strong>
                <small>{t("직원 계정과 상태")}</small>
              </span>
              <em>{agents.length}</em>
            </button>
          </nav>
        </aside>
        <div className="admin-dashboard-content">
      {activeAdminSection === "agents" && (
      <section className="card admin-agent-card">
        <div className="admin-panel-title">
          <div><span className="section-eyebrow">AGENTS</span><h2>{t("Agent 관리")}</h2><p>{t("콜센터 직원 계정과 현재 상태를 관리합니다.")}</p></div>
          <strong>{agents.length}</strong>
        </div>
        <form className="inline-form" onSubmit={addAgent}>
          <input
            aria-label={t("Agent 이름")}
            placeholder={t("이름")}
            value={agentForm.name}
            onChange={(e) =>
              setAgentForm({ ...agentForm, name: e.target.value })
            }
          />
          <input
            aria-label={t("Agent 로그인 ID")}
            placeholder={t("로그인 ID")}
            value={agentForm.loginId}
            onChange={(e) =>
              setAgentForm({ ...agentForm, loginId: e.target.value })
            }
          />
          <input
            aria-label={t("Agent 비밀번호")}
            type="password"
            placeholder={t("비밀번호")}
            value={agentForm.password}
            onChange={(e) =>
              setAgentForm({ ...agentForm, password: e.target.value })
            }
          />
          <button>{t("Agent 추가")}</button>
        </form>
        <div className="table-wrap admin-table">
          <table>
            <thead>
              <tr>
                <th>{t("이름")}</th>
                <th>{t("ID")}</th>
                <th>{t("상태")}</th>
                <th>{t("관리")}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td data-label={t("이름")}>{agent.name}</td>
                  <td data-label={t("ID")}>{agent.loginId}</td>
                  <td data-label={t("상태")}>{agent.status}</td>
                  <td data-label={t("관리")}>
                    <button
                      className="danger compact"
                      onClick={() => void removeAgent(agent)}
                    >
                      {t("삭제")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
      {activeAdminSection === "hotels" && (
      <>
      <section className="card admin-property-card admin-hotel-card">
        <div className="admin-panel-title">
          <div><span className="section-eyebrow">PROPERTY</span><h2>{t("호텔·룸 관리")}</h2><p>{t("호텔과 객실, 고객 접속 QR을 한곳에서 관리합니다.")}</p></div>
          <strong>{rooms.length}</strong>
        </div>
        {hotelError && (
          <div className="error-box form-error" role="alert">
            {hotelError}
          </div>
        )}
        <form className="inline-form hotel-create-form" onSubmit={addHotel}>
          <input
            aria-label={t("호텔 이름")}
            placeholder={t("호텔 이름")}
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
          />
          <button disabled={!hotelName.trim()}>+ {t("호텔 추가")}</button>
        </form>
        <div className="hotel-chip-list">
          <button
            type="button"
            className={selectedHotelId === null ? "active" : ""}
            onClick={() => setSelectedHotelId(null)}
          >
            <span aria-hidden="true">∞</span>
            {t("전체 호텔")}
          </button>
          {hotels.map((hotel) => (
            <button
              type="button"
              key={hotel.id}
              className={selectedHotelId === hotel.id ? "active" : ""}
              onClick={() => {
                setSelectedHotelId(hotel.id);
                setRoomHotelId(hotel.id);
              }}
            >
              <span>{hotel.name.slice(0, 1)}</span>
              {hotel.name}
            </button>
          ))}
        </div>
        {roomError && (
          <div className="error-box form-error" role="alert">
            {roomError}
          </div>
        )}
        <form className="inline-form" onSubmit={addRoom}>
          <select
            aria-label={t("룸을 추가할 호텔")}
            value={roomHotelId}
            onChange={(e) => setRoomHotelId(e.target.value)}
          >
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
          <input
            aria-label={t("객실 번호")}
            placeholder={t("객실 번호")}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <button>{t("룸 추가")}</button>
          <button
            type="button"
            className="danger"
            disabled={!roomHotelId}
            onClick={() => {
              const hotel = hotels.find((item) => item.id === roomHotelId);
              if (hotel) void removeHotel(hotel);
            }}
          >
            {t("선택 호텔 삭제")}
          </button>
        </form>
        <div className="table-wrap admin-table">
          <table>
            <thead>
              <tr>
                <th>{t("호텔")}</th>
                <th>{t("객실")}</th>
                <th>{t("상태")}</th>
                <th>{t("투숙객 주소")}</th>
                <th>{t("QR 관리")}</th>
                <th>{t("관리")}</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td data-label={t("호텔")}>{room.hotel.name}</td>
                  <td data-label={t("객실")}>{room.roomNumber}</td>
                  <td data-label={t("상태")}>{room.status}</td>
                  <td data-label={t("투숙객 주소")} className="room-link-cell">
                    {room.guestUrl ? (
                      <>
                        <a
                          href={room.guestUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("상담 링크 열기")}
                        </a>
                        <button
                          className="secondary compact"
                          onClick={() =>
                            void copyGuestUrl(room.guestUrl!).catch(() =>
                              setError("주소를 복사하지 못했습니다."),
                            )
                          }
                        >
                          {t("주소 복사")}
                        </button>
                      </>
                    ) : (
                      <span>{t("주소 없음")}</span>
                    )}
                  </td>
                  <td data-label={t("QR 관리")}>
                    <button
                      type="button"
                      className="compact"
                      disabled={!room.guestUrl}
                      onClick={() => setQrRoom(room)}
                    >
                      {t("QR 보기")}
                    </button>
                  </td>
                  <td data-label={t("관리")}>
                    <button
                      className="danger compact"
                      onClick={() => void removeRoom(room)}
                    >
                      {t("삭제")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
      <section className="admin-welcome-section">
        <div className="section-head">
          <div><span className="section-eyebrow">GUEST MESSAGE</span><h2>{t("호텔별 Guest 자동 안내문")}</h2><p>{t("위에서 선택한 호텔의 신규 상담 첫 메시지를 언어별로 설정합니다.")}</p></div>
          <div className="welcome-selected-hotel" aria-live="polite">
            <small>{t("현재 선택 호텔")}</small>
            <strong>{selectedHotel?.name ?? t("선택된 호텔 없음")}</strong>
          </div>
        </div>
        {welcomeError && <div className="error-box form-error">{welcomeError}</div>}
        {welcomeSaved && <div className="success-box">{welcomeSaved}</div>}
        <form className="welcome-form" onSubmit={saveWelcomeMessage}>
          <div className="welcome-language-tabs" role="tablist" aria-label={t("안내문 언어")}>
            <button type="button" className={welcomeLanguage === "ja" ? "active" : ""} onClick={() => setWelcomeLanguage("ja")}>日本語</button>
            <button type="button" className={welcomeLanguage === "en" ? "active" : ""} onClick={() => setWelcomeLanguage("en")}>English</button>
          </div>
          <label>{welcomeLanguage === "en" ? "English message" : "日本語メッセージ"}<textarea value={welcomeMessage} onChange={(event) => { setWelcomeMessage(event.target.value); setWelcomeSaved(""); }} maxLength={1000} rows={5}/></label>
          <div className="welcome-actions"><span>{welcomeMessage.length}/1000</span><button disabled={!roomHotelId || !welcomeMessage.trim()}>{t("안내문 저장")}</button></div>
        </form>
      </section>
      </section>
      </>
      )}
        </div>
      </div>
      {qrRoom && <RoomQrModal room={qrRoom} onClose={() => setQrRoom(null)} />}
      {showPasswordChange && (
        <PasswordChangeModal
          auth={auth}
          onClose={() => setShowPasswordChange(false)}
        />
      )}
    </div>
  );
}

function Page({
  auth,
  title,
  subtitle,
  chatMode = false,
  children,
}: React.PropsWithChildren<{
  auth: AgentAuth;
  title: string;
  subtitle: string;
  chatMode?: boolean;
}>): React.JSX.Element {
  const { t } = useI18n();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  function logout(): void {
    clearStoredAuth("AGENT");
    location.href = "/login";
  }
  // 단일 Agent 업무 화면으로 다시 이동할 뿐인 사이드바는 제거하고, 실제로 쓰는 언어·계정 동작만 상단에 모읍니다.
  return (
    <>
    <div className={`shell ${chatMode ? "chat-shell" : ""}`}>
      <main className={chatMode ? "chat-page" : ""}>
        <header>
          <div className="agent-brand">
            REMOTE<span>+</span>
          </div>
          <div className="page-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="agent-header-actions">
            <LanguageSwitcher />
            <div className="profile">
              {auth.agent.name}
              <span>AG</span>
              <button
                className="link-button"
                onClick={() => setShowPasswordChange(true)}
              >
                {t("비밀번호 변경")}
              </button>
              <button className="link-button" onClick={logout}>
                {t("로그아웃")}
              </button>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
    {showPasswordChange && (
      <PasswordChangeModal
        auth={auth}
        onClose={() => setShowPasswordChange(false)}
      />
    )}
    </>
  );
}

/** 인증 상태에 따라 로그인과 Agent 업무 화면 접근을 분리합니다. */
function App(): React.JSX.Element {
  const [staffAuth, setStaffAuth] = useState<AgentAuth | null>(
    () => readStoredAuth("ADMIN") ?? readStoredAuth("AGENT"),
  );

  useEffect(() => {
    /** 서버가 저장된 JWT를 거부하면 오래된 인증을 남기지 않고 역할별 로그인 화면으로 되돌립니다. */
    function invalidateAuth(): void {
      clearStoredAuth("AGENT");
      clearStoredAuth("ADMIN");
      setStaffAuth(null);
    }
    window.addEventListener(AUTH_INVALID_EVENT, invalidateAuth);
    return () => window.removeEventListener(AUTH_INVALID_EVENT, invalidateAuth);
  }, []);

  const loginElement = staffAuth ? (
    <Navigate to={staffHomePath(staffAuth.agent.role)} replace />
  ) : (
    <LoginPage onLogin={setStaffAuth} />
  );
  return (
    <Routes>
      <Route path="/" element={loginElement} />
      <Route path="/login" element={loginElement} />
      <Route
        path={AGENT_WORKSPACE_PATH}
        element={
          staffAuth &&
          canAccessStaffPath(staffAuth.agent.role, AGENT_WORKSPACE_PATH) ? (
            <LineAgentPage auth={staffAuth} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path={ADMIN_DASHBOARD_PATH}
        element={
          staffAuth &&
          canAccessStaffPath(staffAuth.agent.role, ADMIN_DASHBOARD_PATH) ? (
            <AdminPage auth={staffAuth} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path={ADMIN_AGENT_WORKSPACE_PATH}
        element={
          staffAuth &&
          canAccessStaffPath(
            staffAuth.agent.role,
            ADMIN_AGENT_WORKSPACE_PATH,
          ) ? (
            <LineAgentPage auth={staffAuth} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>,
);
