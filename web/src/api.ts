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
    openai?: { model?: string; apiKey?: string; baseUrl?: string };
    gemini?: { model?: string; apiKey?: string };
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

  // scheduler
  getScheduler: () => http<{ running: boolean }>("/api/scheduler"),
  startScheduler: () =>
    http<{ running: boolean }>("/api/scheduler/start", { method: "POST" }),
  stopScheduler: () =>
    http<{ running: boolean }>("/api/scheduler/stop", { method: "POST" }),
};
