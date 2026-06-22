import fs from "node:fs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { config } from "./config.js";
import {
  DEFAULT_AI_PROVIDER_STATE,
  DEFAULT_AI_USAGE,
  DEFAULT_AUTOPILOT,
  DEFAULT_DB,
  type DbSchema,
} from "./types.js";

/** 필요한 데이터 디렉터리를 모두 생성한다. */
export function ensureDirs(): void {
  for (const dir of [
    config.paths.data,
    config.paths.posts,
    config.paths.uploads,
    config.paths.session,
    config.paths.screenshots,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const adapter = new JSONFile<DbSchema>(config.paths.db);
export const db = new Low<DbSchema>(adapter, DEFAULT_DB);

/** DB 를 읽고 기본값을 보정한다. 서버 부팅 시 1회 호출. */
export async function initDb(): Promise<void> {
  ensureDirs();
  await db.read();
  db.data ||= structuredClone(DEFAULT_DB);
  db.data.settings ||= structuredClone(DEFAULT_DB.settings);
  db.data.posts ||= [];
  // 기존 DB 에 없던 필드 보정 + 구버전(단일 OpenAI) → 멀티 프로바이더 마이그레이션
  const ap = (db.data.autopilot ?? {}) as unknown as {
    openai?: { apiKey?: string; model?: string };
    gemini?: { apiKey?: string; model?: string };
    apiKey?: string;
    model?: string;
    [key: string]: unknown;
  };
  const migrated = {
    ...structuredClone(DEFAULT_AUTOPILOT),
    ...ap,
    openai: { ...DEFAULT_AUTOPILOT.openai, ...(ap.openai ?? {}) },
    gemini: { ...DEFAULT_AUTOPILOT.gemini, ...(ap.gemini ?? {}) },
  };
  // 구버전 평면 필드(apiKey/model)를 openai 로 이전
  if (!ap.openai && (ap.apiKey || ap.model)) {
    migrated.openai = {
      apiKey: ap.apiKey ?? "",
      model: ap.model ?? DEFAULT_AUTOPILOT.openai.model,
    };
  }
  delete (migrated as Record<string, unknown>).apiKey;
  delete (migrated as Record<string, unknown>).model;
  db.data.autopilot = migrated;

  if (db.data.keywordPlan === undefined) db.data.keywordPlan = null;

  // AI 사용량 보정
  const usage = (db.data.aiUsage ?? {}) as Partial<typeof DEFAULT_AI_USAGE>;
  db.data.aiUsage = {
    openai: { ...structuredClone(DEFAULT_AI_PROVIDER_STATE), ...(usage.openai ?? {}) },
    gemini: { ...structuredClone(DEFAULT_AI_PROVIDER_STATE), ...(usage.gemini ?? {}) },
  };

  await db.write();
}
