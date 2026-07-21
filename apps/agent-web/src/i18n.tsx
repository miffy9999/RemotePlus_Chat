import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLanguage = "ko" | "ja";

const ja: Record<string, string> = {
  "호텔 상담 센터": "ホテル相談センター", "이용할 업무 화면을 선택한 뒤 로그인하세요.": "利用する業務画面を選択してログインしてください。",
  "관리자 로그인": "管理者ログイン", "호텔·룸·Agent를 관리합니다.": "ホテル・客室・Agentを管理します。", "Agent 로그인": "Agentログイン", "투숙객 상담을 처리합니다.": "宿泊者からの相談に対応します。",
  "상담 센터 계정으로 로그인하세요.": "相談センターのアカウントでログインしてください。", "로그인 ID": "ログインID", "비밀번호": "パスワード", "로그인 중…": "ログイン中…", "로그인": "ログイン", "개발용 계정은 `.env.example`에서 확인할 수 있습니다.": "開発用アカウントは `.env.example` で確認できます。",
  "연결 중": "接続中", "연결됨": "接続済み", "연결 끊김": "切断", "재연결 중": "再接続中", "종료": "終了", "← 목록": "← 一覧", "상담 종료": "相談終了", "아직 메시지가 없습니다.": "メッセージはまだありません。", "나": "自分", "투숙객": "宿泊者", "메시지를 입력하세요": "メッセージを入力してください", "종료된 상담입니다": "終了した相談です", "전송": "送信", "상담을 종료할까요?": "相談を終了しますか？", "종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.": "終了した相談にはこれ以上メッセージを送信できません。", "취소": "キャンセル",
  "Agent 상담 센터": "Agent相談センター", "대기 중인 상담을 확인하고 응답합니다.": "待機中の相談を確認して対応します。", "대기": "待機", "내 진행": "対応中", "내 종료": "終了済み", "대기 상담": "待機中の相談", "오래 기다린 상담부터 확인하세요.": "待ち時間の長い相談から確認してください。", "새로고침": "更新", "상담 수락": "相談を受ける", "내 진행 상담": "対応中の相談", "현재 담당 중인 상담입니다.": "現在担当している相談です。", "상담 열기": "相談を開く", "종료 상담": "終了した相談", "최근 종료되거나 만료된 내 상담입니다.": "最近終了または期限切れになった相談です。", "기록 보기": "履歴を見る",
  "호텔": "ホテル", "객실": "客室", "언어": "言語", "상태": "状態", "만료 시각": "有効期限", "작업": "操作", "표시할 상담이 없습니다.": "表示する相談はありません。", "호 상담": "号室の相談",
  "관리자 페이지": "管理者ページ", "로그아웃": "ログアウト", "Agent 관리": "Agent管理", "Agent 이름": "Agent名", "이름": "名前", "Agent 로그인 ID": "AgentログインID", "Agent 비밀번호": "Agentパスワード", "영문+숫자 8자 이상": "英字＋数字で8文字以上", "Agent 추가": "Agent追加", "ID": "ID", "관리": "管理", "삭제": "削除", "호텔·룸 관리": "ホテル・客室管理", "호텔 이름": "ホテル名", "호텔 추가": "ホテル追加", "룸을 추가할 호텔": "客室を追加するホテル", "객실 번호": "客室番号", "룸 추가": "客室追加", "선택 호텔 삭제": "選択したホテルを削除", "호텔 필터": "ホテル絞り込み", "전체 호텔": "すべてのホテル", "투숙객 주소": "宿泊者URL", "QR 관리": "QR管理", "상담 링크 열기": "相談リンクを開く", "주소 복사": "URLをコピー", "주소 없음": "URLなし", "준비 중": "準備中", "QR 관리는 MVP 이후 제공됩니다.": "QR管理はMVP後に提供予定です。", "Agent 상담": "Agent相談",
  "한국어": "한국어", "일본어": "日本語", "UI 언어": "表示言語"
};

interface LanguageContextValue { language: UiLanguage; setLanguage: (language: UiLanguage) => void; t: (text: string) => string; locale: string; }
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const [language, setLanguage] = useState<UiLanguage>(() => localStorage.getItem("remoteplus-ui-language") === "ja" ? "ja" : "ko");
  useEffect(() => { localStorage.setItem("remoteplus-ui-language", language); document.documentElement.lang = language; }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => language === "ja" ? (ja[text] ?? text) : text, locale: language === "ja" ? "ja-JP" : "ko-KR" }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue { const value = useContext(LanguageContext); if (!value) throw new Error("LanguageProvider가 필요합니다."); return value; }

export function LanguageSwitcher(): React.JSX.Element {
  const { language, setLanguage, t } = useI18n();
  return <label className="language-switcher"><span>{t("UI 언어")}</span><select aria-label={t("UI 언어")} value={language} onChange={(event) => setLanguage(event.target.value as UiLanguage)}><option value="ko">한국어</option><option value="ja">日本語</option></select></label>;
}
