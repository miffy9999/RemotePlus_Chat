import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UiLanguage = "ko" | "ja";

const ja: Record<string, string> = {
  "직원 로그인": "スタッフログイン", "상담 센터 계정으로 로그인하세요.": "相談センターのアカウントでログインしてください。", "계정 역할에 따라 관리 또는 상담 화면으로 이동합니다.": "アカウントの役割に応じて管理または相談画面へ移動します。",
  "로그인 ID": "ログインID", "비밀번호": "パスワード", "로그인 중…": "ログイン中…", "로그인": "ログイン",
  "비밀번호 변경": "パスワード変更", "현재 비밀번호": "現在のパスワード", "새 비밀번호": "新しいパスワード", "새 비밀번호 확인": "新しいパスワードの確認", "변경 중…": "変更中…",
  "변경하면 이 계정으로 로그인한 모든 기기에서 다시 로그인해야 합니다.": "変更すると、このアカウントでログイン中のすべての端末で再ログインが必要です。", "새 비밀번호가 서로 일치하지 않습니다.": "新しいパスワードが一致しません。", "비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인하세요.": "パスワードを変更しました。新しいパスワードで再ログインしてください。", "비밀번호를 변경하지 못했습니다.": "パスワードを変更できませんでした。",
  "연결 중": "接続中", "연결됨": "接続済み", "연결 끊김": "切断", "재연결 중": "再接続中", "종료": "終了", "← 목록": "← 一覧", "상담 종료": "相談終了", "아직 메시지가 없습니다.": "メッセージはまだありません。", "나": "自分", "투숙객": "宿泊者", "메시지를 입력하세요": "メッセージを入力してください", "종료된 상담입니다": "終了した相談です", "전송": "送信", "상담을 종료할까요?": "相談を終了しますか？", "종료한 상담에는 더 이상 메시지를 보낼 수 없습니다.": "終了した相談にはこれ以上メッセージを送信できません。", "취소": "キャンセル",
  "Agent 상담 센터": "Agent相談センター", "대기 중인 상담을 확인하고 응답합니다.": "待機中の相談を確認して対応します。", "대기": "待機", "내 진행": "対応中", "내 종료": "終了済み", "대기 상담": "待機中の相談", "오래 기다린 상담부터 확인하세요.": "待ち時間の長い相談から確認してください。", "새로고침": "更新", "상담 수락": "相談を受ける", "내 진행 상담": "対応中の相談", "현재 담당 중인 상담입니다.": "現在担当している相談です。", "상담 열기": "相談を開く", "종료 상담": "終了した相談", "최근 종료되거나 만료된 내 상담입니다.": "最近終了または期限切れになった相談です。", "기록 보기": "履歴を見る",
  "새 상담이 도착했습니다.": "新しい相談が届きました。", "고객 메시지가 도착했습니다.": "宿泊者からメッセージが届きました。", "대기 상담 보기": "待機中の相談を見る", "알림음 켜기": "通知音をオン", "알림음 끄기": "通知音をオフ", "브라우저 알림 켜기": "ブラウザ通知を有効にする", "브라우저 알림 켜짐": "ブラウザ通知：有効", "브라우저 알림 차단됨": "ブラウザ通知：ブロック中", "브라우저 알림이 켜졌습니다.": "ブラウザ通知を有効にしました。", "탭이 백그라운드여도 새 상담과 메시지를 알려드립니다.": "タブがバックグラウンドでも、新しい相談とメッセージを通知します。", "알림 닫기": "通知を閉じる",
  "호텔": "ホテル", "객실": "客室", "언어": "言語", "상태": "状態", "만료 시각": "有効期限", "작업": "操作", "표시할 상담이 없습니다.": "表示する相談はありません。", "호 상담": "号室の相談",
  "관리자 페이지": "管理者ページ", "로그아웃": "ログアウト", "Agent 관리": "Agent管理", "Agent 이름": "Agent名", "이름": "名前", "Agent 로그인 ID": "AgentログインID", "Agent 비밀번호": "Agentパスワード", "Agent 추가": "Agent追加", "ID": "ID", "관리": "管理", "삭제": "削除", "호텔·룸 관리": "ホテル・客室管理", "호텔 이름": "ホテル名", "호텔 추가": "ホテル追加", "룸을 추가할 호텔": "客室を追加するホテル", "객실 번호": "客室番号", "룸 추가": "客室追加", "선택 호텔 삭제": "選択したホテルを削除", "호텔 필터": "ホテル絞り込み", "전체 호텔": "すべてのホテル", "투숙객 주소": "宿泊者URL", "QR 관리": "QR管理", "상담 링크 열기": "相談リンクを開く", "주소 복사": "URLをコピー", "주소 없음": "URLなし", "QR 보기": "QRを表示", "객실 고정 QR": "客室固定QR", "QR 생성 중…": "QRを生成中…", "QR 코드를 만들 수 없습니다.": "QRコードを生成できません。", "PNG 다운로드": "PNGをダウンロード", "닫기": "閉じる", "고정 QR 안내": "固定QRのご案内", "이 QR은 객실에 인쇄하여 비치하는 고정 QR이며 정기 갱신되지 않습니다.": "このQRは客室に印刷して設置する固定QRで、定期更新されません。", "인쇄 전에 운영 고객 도메인을 확정하고 실제 휴대전화로 스캔을 시험하세요.": "印刷前に運用する宿泊者向けドメインを確定し、実際のスマートフォンで読み取りをテストしてください。", "권장 인쇄 크기는 가로·세로 3cm 이상이며 QR 주변 흰 여백을 자르지 마세요.": "推奨印刷サイズは3cm四方以上です。QR周辺の白い余白は切り取らないでください。", "오픈소스 라이선스 고지": "オープンソースライセンス表示",
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
