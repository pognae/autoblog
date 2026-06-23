import cron, { type ScheduledTask } from "node-cron";
import { db } from "./db.js";
import { createPost } from "./posts.store.js";
import { publishPostById } from "./publisher.service.js";
import { generateArticle, generateMonthlyKeywords } from "./ai.js";
import type { AutopilotConfig } from "./types.js";

/**
 * 오토파일럿: 매일 지정 시각에 ChatGPT 로 글을 생성해 자동 발행한다.
 * - 매달 키워드 계획을 새로 세우고(수익형 키워드)
 * - 매일 postsPerDay 개의 미사용 키워드로 글을 생성/발행한다.
 */

let task: ScheduledTask | null = null;
let running = false;

/** Asia/Seoul 기준 현재 날짜/시각 파츠 */
function seoulParts(): {
  dateStr: string;
  monthStr: string;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    monthStr: `${parts.year}-${parts.month}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

function monthlyKeywordCount(cfg: AutopilotConfig): number {
  return Math.min(80, Math.max(30, cfg.postsPerDay * 31));
}

/** 이번 달 키워드 계획을 보장한다. (없거나 달이 바뀌면 새로 생성, 소진되면 보충) */
async function ensureKeywordPlan(
  monthStr: string,
  cfg: AutopilotConfig,
): Promise<void> {
  const plan = db.data.keywordPlan;
  const needNew = !plan || plan.month !== monthStr;

  if (needNew) {
    console.log(`[autopilot] ${monthStr} 키워드 계획 생성 중...`);
    const keywords = await generateMonthlyKeywords(cfg, monthlyKeywordCount(cfg));
    db.data.keywordPlan = {
      month: monthStr,
      topic: cfg.topic,
      keywords,
      createdAt: new Date().toISOString(),
    };
    await db.write();
    console.log(`[autopilot] 키워드 ${keywords.length}개 생성 완료`);
    return;
  }

  // 같은 달인데 모두 사용했으면 보충
  const exhausted = plan!.keywords.every((k) => k.used);
  if (exhausted) {
    console.log("[autopilot] 키워드 소진 → 추가 생성");
    const more = await generateMonthlyKeywords(cfg, monthlyKeywordCount(cfg));
    const existing = new Set(plan!.keywords.map((k) => k.keyword));
    for (const k of more) {
      if (!existing.has(k.keyword)) plan!.keywords.push(k);
    }
    await db.write();
  }
}

/** 이번 달 키워드 계획을 강제로 새로 생성한다. (UI 재생성 버튼) */
export async function regenerateKeywordPlan(): Promise<number> {
  const cfg = db.data.autopilot;
  const { monthStr } = seoulParts();
  const keywords = await generateMonthlyKeywords(cfg, monthlyKeywordCount(cfg));
  db.data.keywordPlan = {
    month: monthStr,
    topic: cfg.topic,
    keywords,
    createdAt: new Date().toISOString(),
  };
  await db.write();
  return keywords.length;
}

/** 하루치(postsPerDay 개) 글을 생성하고 발행한다. */
export async function runDaily(cfg: AutopilotConfig): Promise<string> {
  const { monthStr } = seoulParts();
  await ensureKeywordPlan(monthStr, cfg);

  const plan = db.data.keywordPlan!;
  const picks = plan.keywords.filter((k) => !k.used).slice(0, cfg.postsPerDay);
  if (picks.length === 0) {
    return "사용 가능한 키워드가 없습니다.";
  }

  const results: string[] = [];
  for (const item of picks) {
    try {
      console.log(`[autopilot] 글 생성: "${item.keyword}"`);
      const article = await generateArticle(cfg, { keyword: item.keyword });

      const post = await createPost({
        markdown: article.markdown,
        title: article.title,
        tags: article.tags,
        visibility: cfg.visibility,
      });

      // 키워드를 사용 처리
      item.used = true;
      item.usedPostId = post.id;
      item.usedAt = new Date().toISOString();
      await db.write();

      console.log(`[autopilot] 발행 시작: "${article.title}"`);
      const pub = await publishPostById(post.id);
      results.push(
        pub.ok
          ? `✅ ${item.keyword} → 발행완료`
          : `⚠️ ${item.keyword} → 발행실패(${pub.error})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`❌ ${item.keyword} → ${msg}`);
      console.error(`[autopilot] 실패: ${item.keyword}`, msg);
    }
  }

  const summary = results.join(" | ");
  console.log(`[autopilot] 완료: ${summary}`);
  return summary;
}

/** 수동 1회 실행 (시간 게이트 무시) — AI 로 새 글을 생성해 발행. lastRunDate 는 건드리지 않음. */
export async function runNow(): Promise<string> {
  const cfg = db.data.autopilot;
  if (running) return "이미 실행 중입니다.";
  running = true;
  try {
    const summary = await runDaily(cfg);
    cfg.lastRunResult = summary;
    cfg.lastRunAt = new Date().toISOString();
    await db.write();
    return summary;
  } finally {
    running = false;
  }
}

/**
 * 지금 즉시 발행 — AI 를 다시 호출하지 않고, 이미 만들어진(미발행) 글 중
 * 오래된 순으로 postsPerDay 개를 골라 발행한다.
 * 대상 상태: draft(초안) / scheduled(예약) / failed(실패). published/publishing 제외.
 */
export async function publishExistingNow(): Promise<string> {
  const cfg = db.data.autopilot;
  if (running) return "이미 실행 중입니다.";
  running = true;
  try {
    const candidates = db.data.posts
      .filter(
        (p) =>
          p.status === "draft" ||
          p.status === "scheduled" ||
          p.status === "failed",
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .slice(0, cfg.postsPerDay);

    if (candidates.length === 0) {
      const msg =
        "발행할 미발행 글이 없습니다. (새 글/업로드로 글을 먼저 만들어 두세요)";
      cfg.lastRunResult = msg;
      cfg.lastRunAt = new Date().toISOString();
      await db.write();
      return msg;
    }

    const results: string[] = [];
    for (const post of candidates) {
      console.log(`[autopilot] 즉시 발행(기존 글): "${post.title}"`);
      const pub = await publishPostById(post.id);
      results.push(
        pub.ok
          ? `✅ ${post.title} → 발행완료`
          : `⚠️ ${post.title} → 발행실패(${pub.error})`,
      );
    }
    const summary = results.join(" | ");
    cfg.lastRunResult = summary;
    cfg.lastRunAt = new Date().toISOString();
    await db.write();
    console.log(`[autopilot] 즉시 발행 완료: ${summary}`);
    return summary;
  } finally {
    running = false;
  }
}

/** 매 분 호출되어, 예약 시각이 지났고 오늘 아직 실행하지 않았으면 하루치 작업을 수행한다. */
async function tick(): Promise<void> {
  const cfg = db.data.autopilot;
  if (!cfg.enabled || running) return;

  const { dateStr, hour, minute } = seoulParts();
  if (cfg.lastRunDate === dateStr) return; // 오늘 이미 실행됨

  // 정각(===)이 아니라 "예약 시각 경과(>=)" 로 판정한다.
  // 그래야 그 1분에 서버가 꺼져 있었거나 tick 이 밀려도, 켜진 뒤 그날 안에 따라잡아 실행된다.
  const nowMinutes = hour * 60 + minute;
  const scheduledMinutes = cfg.hour * 60 + cfg.minute;
  if (nowMinutes < scheduledMinutes) return; // 아직 예약 시각 전

  running = true;
  // 중복 실행 방지를 위해 즉시 날짜 기록
  cfg.lastRunDate = dateStr;
  await db.write();

  try {
    const summary = await runDaily(cfg);
    cfg.lastRunResult = summary;
    cfg.lastRunAt = new Date().toISOString();
    await db.write();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    cfg.lastRunResult = `오류: ${msg}`;
    await db.write();
    console.error("[autopilot] tick 오류:", msg);
  } finally {
    running = false;
  }
}

export function startAutopilot(): void {
  if (task) return;
  task = cron.schedule("* * * * *", () => void tick(), {
    timezone: "Asia/Seoul",
  });
  console.log("[autopilot] 스케줄러 시작됨 (매 분 시각 확인)");
}

export function stopAutopilot(): void {
  task?.stop();
  task = null;
}

export function autopilotStatus(): { schedulerRunning: boolean } {
  return { schedulerRunning: task !== null };
}
