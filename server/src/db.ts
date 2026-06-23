import fs from "node:fs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { config } from "./config.js";
import {
  DEFAULT_AI_PROVIDER_STATE,
  DEFAULT_AI_USAGE,
  DEFAULT_AUTOPILOT,
  DEFAULT_DB,
  DEFAULT_TELEGRAM,
  type DbSchema,
  type TelegramConfig,
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
  // 구버전 평면 필드(apiKey/model)를 openai 로 이전 (모델만)
  if (!ap.openai && ap.model) {
    migrated.openai = { model: ap.model };
  }
  delete (migrated as Record<string, unknown>).apiKey;
  delete (migrated as Record<string, unknown>).model;
  // API 키는 더 이상 DB 에 저장하지 않는다(.env 전용). 구버전 DB 에 남아 있던 키를 제거.
  delete (migrated.openai as Record<string, unknown>).apiKey;
  delete (migrated.gemini as Record<string, unknown>).apiKey;
  // 레거시 기본값(gemini-2.0-flash, 무료 등급 limit:0 빈발)을 사용 가능한 2.5-flash 로 보정
  if (migrated.gemini.model === "gemini-2.0-flash") {
    migrated.gemini.model = DEFAULT_AUTOPILOT.gemini.model;
  }
  db.data.autopilot = migrated;

  if (db.data.keywordPlan === undefined) db.data.keywordPlan = null;

  // AI 사용량 보정
  const usage = (db.data.aiUsage ?? {}) as Partial<typeof DEFAULT_AI_USAGE>;
  db.data.aiUsage = {
    openai: { ...structuredClone(DEFAULT_AI_PROVIDER_STATE), ...(usage.openai ?? {}) },
    gemini: { ...structuredClone(DEFAULT_AI_PROVIDER_STATE), ...(usage.gemini ?? {}) },
  };

  // 텔레그램 알림 설정 보정. 봇 토큰/채팅 ID 는 .env 전용이므로 여기엔 채널 설정만 둔다.
  // (구버전 DB 에 있던 botToken/chatId/단일 intervalMinutes 는 자연스럽게 버려짐)
  const oldT = (db.data.telegram ?? {}) as Partial<TelegramConfig> & {
    intervalMinutes?: number;
  };
  const base = structuredClone(DEFAULT_TELEGRAM);
  const mergedTelegram: TelegramConfig = {
    heartbeat: { ...base.heartbeat, ...(oldT.heartbeat ?? {}) },
    loginAlert: { ...base.loginAlert, ...(oldT.loginAlert ?? {}) },
    failureAlert: { ...base.failureAlert, ...(oldT.failureAlert ?? {}) },
  };
  // 구버전 평면 intervalMinutes 가 있으면 정기 보고(heartbeat) 주기로 이전
  if (typeof oldT.intervalMinutes === "number" && !oldT.heartbeat) {
    mergedTelegram.heartbeat.intervalMinutes = oldT.intervalMinutes;
  }
  db.data.telegram = mergedTelegram;

  await db.write();
}
