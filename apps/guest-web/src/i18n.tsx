import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLanguage = "ja" | "en" | "ko" | "zh";
export const DEFAULT_GUEST_UI_LANGUAGE: UiLanguage = "ja";

const ja: Record<string, string> = {
  "상담을 준비하고 있습니다": "相談を準備しています", "객실 접근 정보를 안전하게 확인하는 중입니다.": "客室のアクセス情報を安全に確認しています。", "실시간 상담 시작": "リアルタイム相談を開始", "상담은 최대 15분 동안 진행되며 텍스트 메시지만 지원합니다.": "相談は最大15分間で、テキストメッセージのみ対応しています。", "상담 언어": "相談言語", "상담 내용이 서비스 제공과 안전한 운영을 위해 저장될 수 있음을 확인했습니다. 비밀번호와 결제정보는 입력하지 않겠습니다.": "サービス提供と安全な運営のため相談内容が保存される場合があることを確認しました。パスワードや決済情報は入力しません。", "상담 준비 중…": "相談準備中…", "상담 시작": "相談開始", "상담을 시작할 수 없습니다": "相談を開始できません", "호텔 고객지원": "ホテルカスタマーサポート", "연결 중": "接続中", "연결됨": "接続済み", "연결 끊김": "切断", "재연결 중": "再接続中", "상담원 연결을 기다리고 있습니다. 연결되면 메시지를 보낼 수 있습니다.": "相談員への接続を待っています。接続後にメッセージを送信できます。", "상담원이 연결되었습니다. 개인정보나 결제 비밀번호는 전송하지 마세요.": "相談員に接続しました。個人情報や決済用パスワードは送信しないでください。", "상담이 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.": "相談は終了しました。これ以上メッセージを送信できません。", "잠시만 기다려 주세요.": "しばらくお待ちください。", "첫 메시지를 보내보세요.": "最初のメッセージを送ってみましょう。", "나": "自分", "상담원": "相談員", "남은 상담 시간": "相談残り時間", "종료": "終了", "메시지": "メッセージ", "메시지를 입력하세요": "メッセージを入力してください", "상담원 연결 또는 종료 상태를 확인하세요": "相談員への接続または終了状態を確認してください", "전송": "送信", "접근 키가 없는 링크입니다. 테스트 링크의 accessKey 값을 확인하세요.": "アクセスキーがないリンクです。リンクのaccessKeyを確認してください。", "상담을 시작하지 못했습니다.": "相談を開始できませんでした。", "상담방 입장에 실패했습니다.": "相談ルームへの入室に失敗しました。", "메시지 전송에 실패했습니다.": "メッセージの送信に失敗しました。"
};

const en: Record<string, string> = {
  "상담을 준비하고 있습니다": "Preparing your consultation", "객실 접근 정보를 안전하게 확인하는 중입니다.": "Securely checking your room access information.", "실시간 상담 시작": "Start live consultation", "상담은 최대 15분 동안 진행되며 텍스트 메시지만 지원합니다.": "Consultations last up to 15 minutes and support text messages only.", "상담 언어": "Consultation language", "상담 내용이 서비스 제공과 안전한 운영을 위해 저장될 수 있음을 확인했습니다. 비밀번호와 결제정보는 입력하지 않겠습니다.": "I understand that the consultation may be stored to provide and operate the service safely. I will not enter passwords or payment information.", "상담 준비 중…": "Preparing…", "상담 시작": "Start consultation", "상담을 시작할 수 없습니다": "Unable to start consultation", "호텔 고객지원": "Hotel Guest Support", "연결 중": "Connecting", "연결됨": "Connected", "연결 끊김": "Disconnected", "재연결 중": "Reconnecting", "상담원 연결을 기다리고 있습니다. 연결되면 메시지를 보낼 수 있습니다.": "Waiting for an agent. You can send messages once connected.", "상담원이 연결되었습니다. 개인정보나 결제 비밀번호는 전송하지 마세요.": "An agent is connected. Do not send personal information or payment passwords.", "상담이 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.": "The consultation has ended. You can no longer send messages.", "잠시만 기다려 주세요.": "Please wait a moment.", "첫 메시지를 보내보세요.": "Send your first message.", "나": "Me", "상담원": "Agent", "남은 상담 시간": "Time remaining", "종료": "Ended", "메시지": "Message", "메시지를 입력하세요": "Type a message", "상담원 연결 또는 종료 상태를 확인하세요": "Check the connection or consultation status", "전송": "Send", "접근 키가 없는 링크입니다. 테스트 링크의 accessKey 값을 확인하세요.": "This link has no access key. Check the accessKey in the link.", "상담을 시작하지 못했습니다.": "The consultation could not be started.", "상담방 입장에 실패했습니다.": "Unable to join the consultation room.", "메시지 전송에 실패했습니다.": "Failed to send the message."
};

const zh: Record<string, string> = {
  "상담을 준비하고 있습니다": "正在准备咨询", "객실 접근 정보를 안전하게 확인하는 중입니다.": "正在安全确认客房访问信息。", "실시간 상담 시작": "开始实时咨询", "상담은 최대 15분 동안 진행되며 텍스트 메시지만 지원합니다.": "咨询最长为15分钟，仅支持文字消息。", "상담 언어": "咨询语言", "상담 내용이 서비스 제공과 안전한 운영을 위해 저장될 수 있음을 확인했습니다. 비밀번호와 결제정보는 입력하지 않겠습니다.": "我已了解，为提供服务和保障安全运营，咨询内容可能会被保存。我不会输入密码或支付信息。", "상담 준비 중…": "正在准备…", "상담 시작": "开始咨询", "상담을 시작할 수 없습니다": "无法开始咨询", "호텔 고객지원": "酒店客户支持", "연결 중": "正在连接", "연결됨": "已连接", "연결 끊김": "连接已断开", "재연결 중": "正在重新连接", "상담원 연결을 기다리고 있습니다. 연결되면 메시지를 보낼 수 있습니다.": "正在等待客服人员。连接后即可发送消息。", "상담원이 연결되었습니다. 개인정보나 결제 비밀번호는 전송하지 마세요.": "客服人员已连接。请勿发送个人信息或支付密码。", "상담이 종료되었습니다. 더 이상 메시지를 보낼 수 없습니다.": "咨询已结束，无法继续发送消息。", "잠시만 기다려 주세요.": "请稍候。", "첫 메시지를 보내보세요.": "请发送第一条消息。", "나": "我", "상담원": "客服", "남은 상담 시간": "剩余咨询时间", "종료": "已结束", "메시지": "消息", "메시지를 입력하세요": "请输入消息", "상담원 연결 또는 종료 상태를 확인하세요": "请确认客服连接或咨询结束状态", "전송": "发送", "접근 키가 없는 링크입니다. 테스트 링크의 accessKey 값을 확인하세요.": "此链接没有访问密钥，请检查链接中的 accessKey。", "상담을 시작하지 못했습니다.": "无法开始咨询。", "상담방 입장에 실패했습니다.": "无法进入咨询室。", "메시지 전송에 실패했습니다.": "消息发送失败。"
};

const translations: Record<UiLanguage, Record<string, string>> = { ja, en, ko: {}, zh };
const locales: Record<UiLanguage, string> = { ja: "ja-JP", en: "en-US", ko: "ko-KR", zh: "zh-CN" };

/** 저장값이나 선택값이 지원 언어가 아니면 게스트 기본 UI인 일본어로 안전하게 되돌립니다. */
export function normalizeGuestUiLanguage(value: string | null): UiLanguage {
  return value === "ja" || value === "en" || value === "ko" || value === "zh" ? value : DEFAULT_GUEST_UI_LANGUAGE;
}

interface Value { language: UiLanguage; setLanguage: (value: UiLanguage) => void; t: (text: string) => string; locale: string; }
const Context = createContext<Value | null>(null);

export function LanguageProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const [language, setLanguage] = useState<UiLanguage>(DEFAULT_GUEST_UI_LANGUAGE);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => translations[language][text] ?? text, locale: locales[language] }), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): Value {
  const value = useContext(Context);
  if (!value) throw new Error("LanguageProvider가 필요합니다.");
  return value;
}
