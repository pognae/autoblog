export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export interface Post {
  id: string;
  title: string;
  fileName: string;
  tags: string[];
  categoryId?: string;
  visibility: "public" | "protected" | "private";
  scheduledAt?: string;
  status: PostStatus;
  publishedUrl?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostDetail extends Post {
  markdown: string;
  html: string;
}

export interface Settings {
  blogName: string;
  loggedIn: boolean;
  lastLoginCheckAt?: string;
}

export type AiProvider = "openai" | "gemini";

export interface ProviderConfigPublic {
  model: string;
  hasApiKey: boolean;
  baseUrl?: string;
}

export interface AutopilotConfig {
  enabled: boolean;
  topic: string;
  audience: string;
  postsPerDay: number;
  hour: number;
  minute: number;
  visibility: Post["visibility"];
  openai: ProviderConfigPublic;
  gemini: ProviderConfigPublic;
  lastRunDate?: string;
  lastRunResult?: string;
  lastRunAt?: string;
}

export interface ProviderStatus {
  provider: AiProvider;
  model: string;
  configured: boolean;
  usedTokens: number;
  requests: number;
  available: boolean | null;
  lastError?: string;
  lastCheckedAt?: string;
  lastUsedAt?: string;
}

export interface KeywordItem {
  keyword: string;
  rationale?: string;
  used: boolean;
  usedPostId?: string;
  usedAt?: string;
}

export interface KeywordPlan {
  month: string;
  topic: string;
  keywords: KeywordItem[];
  createdAt: string;
}

export interface AutopilotState {
  config: AutopilotConfig;
  plan: KeywordPlan | null;
  status: { schedulerRunning: boolean };
}

export interface TelegramChannel {
  enabled: boolean;
  intervalMinutes: number;
}

export interface MonitorStatus {
  configured: boolean;
  running: boolean;
  hasToken: boolean;
  chatId: string;
  fromEnv: boolean;
  heartbeat: TelegramChannel;
  loginAlert: TelegramChannel;
  failureAlert: TelegramChannel;
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `요청 실패 (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // posts
  listPosts: () => http<Post[]>("/api/posts"),
  getPost: (id: string) => http<PostDetail>(`/api/posts/${id}`),
  createPost: (data: {
    markdown: string;
    title?: string;
    tags?: string[];
    categoryId?: string;
    visibility?: Post["visibility"];
    scheduledAt?: string;
  }) =>
    http<Post>("/api/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePost: (
    id: string,
    data: {
      title?: string;
      markdown?: string;
      tags?: string[];
      categoryId?: string | null;
      visibility?: Post["visibility"];
      scheduledAt?: string | null;
    },
  ) =>
    http<Post>(`/api/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePost: (id: string) =>
    http<void>(`/api/posts/${id}`, { method: "DELETE" }),
  publishNow: (id: string) =>
    http<{ ok: boolean; url?: string; error?: string }>(
      `/api/posts/${id}/publish`,
      { method: "POST" },
    ),
  uploadFiles: async (files: FileList, scheduledAt?: string) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    if (scheduledAt) form.append("scheduledAt", scheduledAt);
    const res = await fetch("/api/posts/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("업로드 실패");
    return res.json() as Promise<Post[]>;
  },

  // settings
  getSettings: () => http<Settings>("/api/settings"),
  updateSettings: (data: { blogName?: string }) =>
    http<Settings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  login: () =>
    http<Settings & { success: boolean }>("/api/settings/login", {
      method: "POST",
    }),
  checkSession: () =>
    http<Settings>("/api/settings/check-session", { method: "POST" }),
  /** 현재 로그인 세션 파일(state.json)을 받아 브라우저에서 다운로드 */
  exportSession: async () => {
    const res = await fetch("/api/settings/session/export");
    if (!res.ok) {
      let message = "세션 내보내기 실패";
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tistory-session.json";
    a.click();
    URL.revokeObjectURL(url);
  },
  /** 로컬에서 내보낸 세션 JSON 을 업로드해 적용 */
  importSession: (state: unknown) =>
    http<Settings & { imported: boolean }>("/api/settings/session/import", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  // autopilot
  getAutopilot: () => http<AutopilotState>("/api/autopilot"),
  updateAutopilot: (data: {
    enabled?: boolean;
    topic?: string;
    audience?: string;
    postsPerDay?: number;
    hour?: number;
    minute?: number;
    visibility?: Post["visibility"];
    openai?: { model?: string; baseUrl?: string };
    gemini?: { model?: string };
  }) =>
    http<{ config: AutopilotConfig; plan: KeywordPlan | null }>(
      "/api/autopilot",
      { method: "PUT", body: JSON.stringify(data) },
    ),

  // ai status / 사용량
  getAiStatus: () => http<{ providers: ProviderStatus[] }>("/api/ai"),
  checkAi: () =>
    http<{ providers: ProviderStatus[] }>("/api/ai/check", { method: "POST" }),
  regenerateKeywords: () =>
    http<{ count: number; plan: KeywordPlan }>("/api/autopilot/keywords", {
      method: "POST",
    }),
  runAutopilot: () =>
    http<{ summary: string; config: AutopilotConfig }>("/api/autopilot/run", {
      method: "POST",
    }),
  /** AI 호출 없이 이미 만들어진 미발행 글을 postsPerDay 개 발행 */
  runAutopilotExisting: () =>
    http<{ summary: string; config: AutopilotConfig }>(
      "/api/autopilot/run-existing",
      { method: "POST" },
    ),

  // monitor (텔레그램 알림)
  getMonitor: () => http<MonitorStatus>("/api/monitor"),
  updateMonitor: (data: {
    heartbeat?: Partial<TelegramChannel>;
    loginAlert?: Partial<TelegramChannel>;
    failureAlert?: Partial<TelegramChannel>;
  }) =>
    http<MonitorStatus>("/api/monitor", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testMonitor: () =>
    http<{ ok: boolean }>("/api/monitor/test", { method: "POST" }),

  // scheduler
  getScheduler: () => http<{ running: boolean }>("/api/scheduler"),
  startScheduler: () =>
    http<{ running: boolean }>("/api/scheduler/start", { method: "POST" }),
  stopScheduler: () =>
    http<{ running: boolean }>("/api/scheduler/stop", { method: "POST" }),
};
