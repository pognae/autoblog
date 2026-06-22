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

/** 제공자별 설정 (API 키 + 모델) */
export interface AiProviderConfig {
  /** UI 에서 입력한 API 키 (있으면 env 보다 우선) */
  apiKey: string;
  /** 사용할 모델 */
  model: string;
  /**
   * OpenAI 호환 base URL. 비워두면 공식 API(api.openai.com) 사용.
   * openai-oauth 로컬 프록시(http://127.0.0.1:10531/v1)를 넣으면
   * ChatGPT 계정 OAuth 토큰으로 API 키 없이 호출한다.
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

export interface DbSchema {
  settings: Settings;
  posts: Post[];
  autopilot: AutopilotConfig;
  keywordPlan: KeywordPlan | null;
  aiUsage: AiUsage;
}

export const DEFAULT_AUTOPILOT: AutopilotConfig = {
  enabled: false,
  topic: "",
  audience: "",
  postsPerDay: 2,
  hour: 10,
  minute: 0,
  visibility: "public",
  openai: { apiKey: "", model: "gpt-4o-mini", baseUrl: "" },
  gemini: { apiKey: "", model: "gemini-2.0-flash" },
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

export const DEFAULT_DB: DbSchema = {
  settings: {
    blogName: "",
    loggedIn: false,
  },
  posts: [],
  autopilot: structuredClone(DEFAULT_AUTOPILOT),
  keywordPlan: null,
  aiUsage: structuredClone(DEFAULT_AI_USAGE),
};
