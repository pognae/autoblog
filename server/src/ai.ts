import OpenAI from "openai";
import { config } from "./config.js";
import { db } from "./db.js";
import type {
  AiProvider,
  AutopilotConfig,
  KeywordItem,
} from "./types.js";

/**
 * AI(LLM) 연동 모듈 — OpenAI + Google Gemini.
 *
 * - 두 제공자 중 키가 등록된 것을 사용하며, 호출이 실패(할당량 초과/오류)하면
 *   자동으로 다른 제공자로 전환(failover)한다.
 * - 제공자는 잔여 토큰(잔액) 조회 API 를 제공하지 않으므로, 응답의 usage 를
 *   누적 집계해 "사용한 토큰"을 보여준다. 사용 가능 여부는 마지막 호출 결과로 판단.
 */

// API 키는 민감정보이므로 환경변수(.env)에서만 읽는다. (설정 파일/DB 에 저장하지 않음)
function openaiKey(): string {
  return config.openai.apiKey;
}
function geminiKey(): string {
  return config.gemini.apiKey;
}
/** openai-oauth 등 OpenAI 호환 프록시 base URL (있으면 API 키 없이도 사용 가능). 비밀 아님 → cfg 우선. */
function openaiBaseUrl(cfg: AutopilotConfig): string {
  return cfg.openai.baseUrl?.trim() || config.openai.baseUrl;
}
/** OpenAI 사용 가능 조건: API 키가 있거나, OAuth 프록시 base URL 이 설정됨 */
function openaiEnabled(cfg: AutopilotConfig): boolean {
  return Boolean(openaiKey() || openaiBaseUrl(cfg));
}

/** 키가 등록된 제공자 목록 */
export function configuredProviders(cfg: AutopilotConfig): AiProvider[] {
  const list: AiProvider[] = [];
  if (openaiEnabled(cfg)) list.push("openai");
  if (geminiKey()) list.push("gemini");
  return list;
}

/** 사용 가능(available) 한 쪽을 먼저 시도하도록 정렬 (true > null > false) */
function orderByAvailability(providers: AiProvider[]): AiProvider[] {
  const rank = (p: AiProvider): number => {
    const a = db.data.aiUsage[p].available;
    return a === true ? 0 : a === null ? 1 : 2;
  };
  return [...providers].sort((x, y) => rank(x) - rank(y));
}

async function recordSuccess(p: AiProvider, tokens: number): Promise<void> {
  const s = db.data.aiUsage[p];
  s.usedTokens += tokens;
  s.requests += 1;
  s.available = true;
  s.lastError = undefined;
  s.lastUsedAt = new Date().toISOString();
  s.lastCheckedAt = s.lastUsedAt;
  await db.write();
}

async function recordFailure(p: AiProvider, message: string): Promise<void> {
  const s = db.data.aiUsage[p];
  s.available = false;
  s.lastError = message;
  s.lastCheckedAt = new Date().toISOString();
  await db.write();
}

/** 모델 응답에서 JSON 을 안전하게 파싱 */
function parseJson<T>(raw: string): T {
  if (!raw) throw new Error("AI 응답이 비어 있습니다.");
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI 응답을 JSON 으로 파싱하지 못했습니다.");
  }
}

interface RawCompletion {
  text: string;
  tokens: number;
}

async function callOpenAI(
  system: string,
  user: string,
  cfg: AutopilotConfig,
  temperature: number,
): Promise<RawCompletion> {
  const baseUrl = openaiBaseUrl(cfg);
  const proxyMode = Boolean(baseUrl);
  // 프록시(openai-oauth) 모드는 OAuth 토큰을 쓰므로 키가 필요 없다.
  // OpenAI SDK 는 비어 있는 apiKey 를 거부하므로 자리표시자를 넣는다.
  const apiKey = openaiKey() || (proxyMode ? "openai-oauth" : "");
  const client = new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });
  const res = await client.chat.completions.create({
    model: cfg.openai.model || config.openai.model,
    temperature,
    // Codex(OAuth 프록시) 백엔드는 response_format 을 지원하지 않을 수 있어
    // 프록시 모드에서는 생략하고, 프롬프트의 JSON 지시 + parseJson 으로 처리한다.
    ...(proxyMode ? {} : { response_format: { type: "json_object" as const } }),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return {
    text: res.choices[0]?.message?.content ?? "",
    tokens: res.usage?.total_tokens ?? 0,
  };
}

async function callGemini(
  system: string,
  user: string,
  cfg: AutopilotConfig,
  temperature: number,
): Promise<RawCompletion> {
  const key = geminiKey();
  const model = cfg.gemini.model || config.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text();
    let message = detail;
    try {
      const j = JSON.parse(detail) as { error?: { message?: string } };
      if (j.error?.message) message = j.error.message;
    } catch {
      /* 그대로 사용 */
    }
    const err = new Error(`Gemini ${r.status}: ${String(message).slice(0, 200)}`);
    (err as { status?: number }).status = r.status;
    throw err;
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? "";
  return { text, tokens: data.usageMetadata?.totalTokenCount ?? 0 };
}

export interface CompletionResult {
  text: string;
  provider: AiProvider;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 429/할당량/레이트리밋 류 오류인지 */
function isQuotaError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = errorMessage(err);
  return status === 429 || /\b429\b|quota|rate ?limit|RESOURCE_EXHAUSTED/i.test(msg);
}

/** "분당 한도" 처럼 잠시 후 풀리는 일시적 초과인지 (재시도 가치 있음) */
function isTransientRateLimit(err: unknown): boolean {
  return /per[\s-]?minute|PerMinute|RequestsPerMinute|try again|retry/i.test(
    errorMessage(err),
  );
}

/** 무료 등급 한도 자체가 0 (= 이 프로젝트에 무료 등급이 부여되지 않음) */
function isFreeTierUnavailable(err: unknown): boolean {
  const msg = errorMessage(err);
  return /limit:\s*0/i.test(msg) && /free[_\s-]?tier/i.test(msg);
}

/** 사용자에게 보여줄 친절한 한국어 오류 메시지 */
function friendlyError(provider: AiProvider, err: unknown): string {
  const name = provider === "openai" ? "OpenAI" : "Gemini";
  if (isFreeTierUnavailable(err)) {
    return `${name} 무료 등급 한도가 0 입니다. 이 API 키의 프로젝트는 무료 등급이 적용되지 않습니다 → 새 키 발급(새 프로젝트) 또는 결제(billing) 활성화가 필요합니다.`;
  }
  if (isQuotaError(err)) {
    return `${name} 할당량 초과(429). 무료/유료 한도를 모두 소진했거나 결제 설정이 필요합니다.`;
  }
  return `${name}: ${errorMessage(err)}`;
}

async function callProvider(
  provider: AiProvider,
  system: string,
  user: string,
  cfg: AutopilotConfig,
  temperature: number,
): Promise<RawCompletion> {
  return provider === "openai"
    ? callOpenAI(system, user, cfg, temperature)
    : callGemini(system, user, cfg, temperature);
}

/**
 * 키가 등록된 제공자를 순서대로 시도하고, 실패 시 다음 제공자로 자동 전환한다.
 * 일시적인 분당 한도(429) 는 한 번 대기 후 재시도한다.
 */
async function complete(
  system: string,
  user: string,
  cfg: AutopilotConfig,
  temperature: number,
): Promise<CompletionResult> {
  const providers = orderByAvailability(configuredProviders(cfg));
  if (providers.length === 0) {
    throw new Error(
      "등록된 AI API 키가 없습니다. 서버 환경변수(.env)에 OPENAI_API_KEY 또는 GEMINI_API_KEY 를 설정해 주세요.",
    );
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      let result: RawCompletion;
      try {
        result = await callProvider(provider, system, user, cfg, temperature);
      } catch (err) {
        // 분당 한도 등 일시적 429 면 잠시 대기 후 1회 재시도 (단, 무료 한도가 0이면 무의미하므로 제외)
        if (isQuotaError(err) && isTransientRateLimit(err) && !isFreeTierUnavailable(err)) {
          console.warn(`[ai] ${provider} 일시적 429 → 8초 후 재시도`);
          await sleep(8000);
          result = await callProvider(provider, system, user, cfg, temperature);
        } else {
          throw err;
        }
      }

      if (!result.text) throw new Error("빈 응답");
      await recordSuccess(provider, result.tokens);
      console.log(
        `[ai] ${provider} 사용 (누적 ${db.data.aiUsage[provider].usedTokens} 토큰)`,
      );
      return { text: result.text, provider };
    } catch (err) {
      const friendly = friendlyError(provider, err);
      console.warn(`[ai] ${provider} 실패 → ${errorMessage(err)}`);
      await recordFailure(provider, friendly);
      errors.push(friendly);
    }
  }
  throw new Error(`모든 AI 호출 실패 → ${errors.join(" | ")}`);
}

/** 가벼운 핑으로 제공자 사용 가능 여부를 갱신한다. */
export async function checkProvider(
  provider: AiProvider,
  cfg: AutopilotConfig,
): Promise<void> {
  const system = "You are a health check.";
  const user = 'Reply with this exact JSON: {"ok":true}';
  try {
    const { tokens } =
      provider === "openai"
        ? await callOpenAI(system, user, cfg, 0)
        : await callGemini(system, user, cfg, 0);
    await recordSuccess(provider, tokens);
  } catch (err) {
    await recordFailure(provider, friendlyError(provider, err));
  }
}

/** 등록된 모든 제공자의 상태를 확인한다. */
export async function checkAllProviders(cfg: AutopilotConfig): Promise<void> {
  for (const p of configuredProviders(cfg)) {
    await checkProvider(p, cfg);
  }
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

/** 화면 표시용 제공자 상태 목록 */
export function getAiStatus(cfg: AutopilotConfig): ProviderStatus[] {
  const configured = new Set(configuredProviders(cfg));
  const entries: Array<{ provider: AiProvider; model: string }> = [
    { provider: "openai", model: cfg.openai.model || config.openai.model },
    { provider: "gemini", model: cfg.gemini.model || config.gemini.model },
  ];
  return entries.map(({ provider, model }) => {
    const s = db.data.aiUsage[provider];
    return {
      provider,
      model,
      configured: configured.has(provider),
      usedTokens: s.usedTokens,
      requests: s.requests,
      available: s.available,
      lastError: s.lastError,
      lastCheckedAt: s.lastCheckedAt,
      lastUsedAt: s.lastUsedAt,
    };
  });
}

/** 한 달치 수익형 키워드를 선정한다. */
export async function generateMonthlyKeywords(
  cfg: AutopilotConfig,
  count: number,
): Promise<KeywordItem[]> {
  const safeCount = Math.max(1, Math.min(count, 80));

  const system = [
    "당신은 한국어 수익형 블로그(애드센스/제휴 광고)를 운영하는 SEO·콘텐츠 마케팅 전문가입니다.",
    "광고 수익(높은 CPC, 충분한 검색량, 현실적인 경쟁도)을 극대화할 수 있는 키워드를 선정합니다.",
    "정보성·구매 의도가 있는 롱테일 키워드를 선호하고, 계절성/트렌드를 고려합니다.",
    "반드시 한국어 키워드로, 서로 겹치지 않게 다양하게 제시합니다.",
  ].join(" ");

  const user = [
    `블로그 주제(니치): ${cfg.topic || "일반 정보/라이프스타일"}`,
    cfg.audience ? `타깃 독자: ${cfg.audience}` : "",
    `이번 달에 사용할 ${safeCount}개의 키워드를 선정하세요.`,
    "각 키워드는 한국어이며, 광고 수익 관점의 선정 이유(rationale)를 한 문장으로 덧붙이세요.",
    '반드시 다음 JSON 형식으로만 답하세요: {"keywords":[{"keyword":"...","rationale":"..."}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await complete(system, user, cfg, 0.8);
  const parsed = parseJson<{
    keywords: Array<{ keyword: string; rationale?: string }>;
  }>(text);

  const seen = new Set<string>();
  const items: KeywordItem[] = [];
  for (const k of parsed.keywords ?? []) {
    const keyword = String(k.keyword ?? "").trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    items.push({ keyword, rationale: k.rationale?.trim(), used: false });
  }
  if (items.length === 0) throw new Error("키워드를 생성하지 못했습니다.");
  return items;
}

export interface GeneratedArticle {
  title: string;
  markdown: string;
  tags: string[];
}

/** 키워드 기반으로 블로그 글(제목/본문/태그)을 생성한다. */
export async function generateArticle(
  cfg: AutopilotConfig,
  input: { keyword: string },
): Promise<GeneratedArticle> {
  const system = [
    "당신은 한국어 수익형 블로그 글을 쓰는 전문 카피라이터이자 SEO 에디터입니다.",
    "독자에게 실질적인 정보를 제공하면서 광고 클릭을 유도할 수 있는, 신뢰도 높고 읽기 쉬운 글을 씁니다.",
    "표절 없이 독창적으로 작성하고, 과장·허위 정보는 피합니다.",
  ].join(" ");

  const user = [
    `핵심 키워드: "${input.keyword}"`,
    cfg.topic ? `블로그 주제: ${cfg.topic}` : "",
    cfg.audience ? `타깃 독자: ${cfg.audience}` : "",
    "",
    "위 키워드로 SEO 에 최적화된 한국어 블로그 글을 작성하세요. 요구사항:",
    "- 제목(title): 클릭을 유도하는 매력적인 제목 (키워드 포함, 35자 내외)",
    "- 본문(markdown): 마크다운 형식. 도입부 + ## 소제목 여러 개 + 결론 구조.",
    "  1500자 이상, 키워드를 자연스럽게 반복, 목록/표 등 가독성 요소 활용.",
    "  맨 앞에 글 제목(#)은 넣지 말 것(제목은 title 로만 제공).",
    "- 태그(tags): 5~8개의 관련 한국어 태그 배열.",
    "",
    '반드시 다음 JSON 형식으로만 답하세요: {"title":"...","markdown":"...","tags":["...","..."]}',
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await complete(system, user, cfg, 0.85);
  const parsed = parseJson<{
    title?: string;
    markdown?: string;
    tags?: unknown;
  }>(text);

  const title = String(parsed.title ?? "").trim();
  const markdown = String(parsed.markdown ?? "").trim();
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
    : [];

  if (!title || !markdown) throw new Error("글 생성 결과가 비어 있습니다.");
  return { title, markdown, tags };
}
