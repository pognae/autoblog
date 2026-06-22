import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  autopilotStatus,
  regenerateKeywordPlan,
  runNow,
} from "../autopilot.js";
import type { AutopilotConfig } from "../types.js";

export const autopilotRouter = Router();

/** API 키는 노출하지 않고, 설정 여부(hasApiKey)만 내려준다. */
function publicConfig(cfg: AutopilotConfig) {
  const { openai, gemini, ...rest } = cfg;
  return {
    ...rest,
    openai: {
      model: openai.model,
      hasApiKey: Boolean(openai.apiKey),
      baseUrl: openai.baseUrl ?? "",
    },
    gemini: { model: gemini.model, hasApiKey: Boolean(gemini.apiKey) },
  };
}

autopilotRouter.get("/", (_req, res) => {
  res.json({
    config: publicConfig(db.data.autopilot),
    plan: db.data.keywordPlan,
    status: autopilotStatus(),
  });
});

const providerSchema = z
  .object({
    model: z.string().optional(),
    /** 빈 문자열이면 기존 키 유지 */
    apiKey: z.string().optional(),
    /** OpenAI 호환 base URL (빈 문자열이면 공식 API 로 초기화) */
    baseUrl: z.string().optional(),
  })
  .optional();

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  topic: z.string().optional(),
  audience: z.string().optional(),
  postsPerDay: z.number().int().min(1).max(10).optional(),
  hour: z.number().int().min(0).max(23).optional(),
  minute: z.number().int().min(0).max(59).optional(),
  visibility: z.enum(["public", "protected", "private"]).optional(),
  openai: providerSchema,
  gemini: providerSchema,
});

autopilotRouter.put("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const cfg = db.data.autopilot;
  const d = parsed.data;
  if (d.enabled !== undefined) cfg.enabled = d.enabled;
  if (d.topic !== undefined) cfg.topic = d.topic;
  if (d.audience !== undefined) cfg.audience = d.audience;
  if (d.postsPerDay !== undefined) cfg.postsPerDay = d.postsPerDay;
  if (d.hour !== undefined) cfg.hour = d.hour;
  if (d.minute !== undefined) cfg.minute = d.minute;
  if (d.visibility !== undefined) cfg.visibility = d.visibility;

  for (const provider of ["openai", "gemini"] as const) {
    const p = d[provider];
    if (!p) continue;
    if (p.model !== undefined) cfg[provider].model = p.model;
    if (p.apiKey !== undefined && p.apiKey.trim() !== "") {
      cfg[provider].apiKey = p.apiKey.trim();
    }
    // baseUrl 은 빈 문자열로 초기화(공식 API 복귀)도 허용하므로 undefined 만 건너뛴다.
    if (provider === "openai" && p.baseUrl !== undefined) {
      cfg.openai.baseUrl = p.baseUrl.trim();
    }
  }

  await db.write();
  res.json({ config: publicConfig(cfg), plan: db.data.keywordPlan });
});

// 이번 달 키워드 강제 재생성
autopilotRouter.post("/keywords", async (_req, res) => {
  try {
    const count = await regenerateKeywordPlan();
    res.json({ count, plan: db.data.keywordPlan });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "생성 실패" });
  }
});

// 지금 1회 실행 (글 생성 + 발행)
autopilotRouter.post("/run", async (_req, res) => {
  try {
    const summary = await runNow();
    res.json({ summary, config: publicConfig(db.data.autopilot) });
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "실행 실패" });
  }
});
