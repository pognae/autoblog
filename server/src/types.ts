export type PostStatus =
  | "draft" // 초안 (예약 안 됨)
  | "scheduled" // 예약됨 (발행 대기)
  | "publishing" // 발행 진행 중
  | "published" // 발행 완료
  | "failed"; // 발행 실패

export interface Post {
  id: string;
  title: string;
  /** 마크다운 원본 파일명 (data/posts 안) */
  fileName: string;
  /** 태그 (콤마 없이 배열로 관리) */
  tags: string[];
  /** 티스토리 카테고리 ID (선택). 비우면 '분류 없음' */
  categoryId?: string;
  /** 공개 범위: public(공개) / protected(보호) / private(비공개) */
  visibility: "public" | "protected" | "private";
  /** 예약 발행 시각 (ISO 문자열). 없으면 초안 */
  scheduledAt?: string;
  status: PostStatus;
  /** 발행 완료된 글의 URL */
  publishedUrl?: string;
  /** 마지막 실패 사유 */
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  /** 티스토리 블로그 이름 (예: myblog -> myblog.tistory.com) */
  blogName: string;
  /** 로그인 세션이 저장되어 사용 가능한 상태인지 */
  loggedIn: boolean;
  /** 마지막 로그인 확인 시각 */
  lastLoginCheckAt?: string;
}

/** 월간 키워드 항목 (ChatGPT 가 선정) */
export interface KeywordItem {
  keyword: string;
  /** 선정 이유 / 수익성 근거 */
  rationale?: string;
  /** 이미 글로 사용했는지 */
  used: boolean;
  usedPostId?: string;
  usedAt?: string;
}

/** 한 달치 키워드 계획 */
export interface KeywordPlan {
  /** "YYYY-MM" */
  month: string;
  /** 계획 생성 당시의 블로그 주제 */
  topic: string;
  keywords: KeywordItem[];
  createdAt: string;
}

/** AI 제공자 */
export type AiProvider = "openai" | "gemini";

/**
 * 제공자별 설정 (모델 + 선택적 base URL).
 *
 * ⚠️ API 키는 여기(=db.json/app-config.json)에 저장하지 않는다.
 *    키는 민감정보이므로 환경변수(.env: OPENAI_API_KEY / GEMINI_API_KEY)에서만 읽는다.
 *    그래야 설정 파일을 git/배포에 안전하게 포함할 수 있다.
 */
export interface AiProviderConfig {
  /** 사용할 모델 */
  model: string;
  /**
   * OpenAI 호환 base URL. 비워두면 공식 API(api.openai.com) 사용.
   * openai-oauth 로컬 프록시(http://127.0.0.1:10531/v1)를 넣으면
   * ChatGPT 계정 OAuth 토큰으로 API 키 없이 호출한다. (민감정보 아님)
   */
  baseUrl?: string;
}

/** 자동 발행(오토파일럿) 설정 */
export interface AutopilotConfig {
  /** 자동 글 생성/발행 활성화 */
  enabled: boolean;
  /** 블로그 주제/니치 (키워드 선정 기준) */
  topic: string;
  /** 타깃 독자 (선택) */
  audience: string;
  /** 하루 발행 개수 */
  postsPerDay: number;
  /** 실행 시각 (시, 분) — Asia/Seoul 기준 */
  hour: number;
  minute: number;
  /** 자동 발행 글의 공개 범위 */
  visibility: Post["visibility"];
  /** 제공자별 설정 */
  openai: AiProviderConfig;
  gemini: AiProviderConfig;
  /** 마지막 실행 날짜 "YYYY-MM-DD" (중복 실행 방지) */
  lastRunDate?: string;
  /** 마지막 실행 결과 메시지 */
  lastRunResult?: string;
  lastRunAt?: string;
}

/** 제공자별 사용량/상태 (잔여 토큰 API 가 없어 직접 집계) */
export interface AiProviderState {
  /** 누적 사용 토큰 */
  usedTokens: number;
  /** 누적 요청 수 */
  requests: number;
  /** 마지막으로 확인된 사용 가능 여부 (null = 미확인) */
  available: boolean | null;
  lastError?: string;
  lastCheckedAt?: string;
  lastUsedAt?: string;
}

export interface AiUsage {
  openai: AiProviderState;
  gemini: AiProviderState;
}

/** 텔레그램 알림 종류 (채널) — 각각 on/off + 개별 주기(분) */
export interface TelegramChannel {
  /** 이 종류의 알림을 보낼지 */
  enabled: boolean;
  /** 점검/전송 주기(분) */
  intervalMinutes: number;
}

/**
 * 텔레그램 알림 설정 (종류별 on/off + 주기).
 *
 * ⚠️ 봇 토큰/채팅 ID 는 여기에 저장하지 않는다. 민감정보이므로
 *    환경변수(.env: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)에서만 읽는다.
 *    여기에는 비밀이 아닌 "어떤 알림을 얼마나 자주 보낼지"만 둔다.
 */
export interface TelegramConfig {
  /** 정기 상태 보고 (서버/로그인/글 통계 요약) */
  heartbeat: TelegramChannel;
  /** 로그인 세션 만료 경고 */
  loginAlert: TelegramChannel;
  /** 발행 실패 글 알림 */
  failureAlert: TelegramChannel;
}

export interface DbSchema {
  settings: Settings;
  posts: Post[];
  autopilot: AutopilotConfig;
  keywordPlan: KeywordPlan | null;
  aiUsage: AiUsage;
  telegram: TelegramConfig;
}

export const DEFAULT_AUTOPILOT: AutopilotConfig = {
  enabled: false,
  topic: "",
  audience: "",
  postsPerDay: 2,
  hour: 10,
  minute: 0,
  visibility: "public",
  openai: { model: "gpt-4o-mini", baseUrl: "" },
  // gemini-2.0-flash 는 무료 등급 한도가 0(limit:0)인 경우가 많아 2.5-flash 를 기본값으로 둔다.
  gemini: { model: "gemini-2.5-flash" },
};

export const DEFAULT_AI_PROVIDER_STATE: AiProviderState = {
  usedTokens: 0,
  requests: 0,
  available: null,
};

export const DEFAULT_AI_USAGE: AiUsage = {
  openai: structuredClone(DEFAULT_AI_PROVIDER_STATE),
  gemini: structuredClone(DEFAULT_AI_PROVIDER_STATE),
};

export const DEFAULT_TELEGRAM: TelegramConfig = {
  heartbeat: { enabled: true, intervalMinutes: 360 },
  loginAlert: { enabled: true, intervalMinutes: 60 },
  failureAlert: { enabled: true, intervalMinutes: 60 },
};

export const DEFAULT_DB: DbSchema = {
  settings: {
    blogName: "",
    loggedIn: false,
  },
  posts: [],
  autopilot: structuredClone(DEFAULT_AUTOPILOT),
  keywordPlan: null,
  aiUsage: structuredClone(DEFAULT_AI_USAGE),
  telegram: structuredClone(DEFAULT_TELEGRAM),
};
