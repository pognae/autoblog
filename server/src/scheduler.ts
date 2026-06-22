import cron, { type ScheduledTask } from "node-cron";
import { config } from "./config.js";
import { db } from "./db.js";
import { publishPostById } from "./publisher.service.js";

let task: ScheduledTask | null = null;
let running = false;

/** 발행 시각이 지난 예약 글을 찾아 순차 발행한다. */
async function tick(): Promise<void> {
  if (running) return; // 이전 주기가 아직 처리 중이면 건너뜀
  running = true;
  try {
    const now = Date.now();
    const due = db.data.posts.filter(
      (p) =>
        p.status === "scheduled" &&
        p.scheduledAt &&
        new Date(p.scheduledAt).getTime() <= now,
    );

    for (const post of due) {
      console.log(`[scheduler] 발행 시작: ${post.title} (${post.id})`);
      const result = await publishPostById(post.id);
      console.log(
        result.ok
          ? `[scheduler] 발행 완료: ${post.title} -> ${result.url ?? "(URL 미확인)"}`
          : `[scheduler] 발행 실패: ${post.title} -> ${result.error}`,
      );
    }
  } catch (err) {
    console.error("[scheduler] tick 오류:", err);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (task) return;
  task = cron.schedule(config.scheduler.cron, () => void tick(), {
    timezone: "Asia/Seoul",
  });
  console.log(`[scheduler] 시작됨 (cron: ${config.scheduler.cron})`);
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
  console.log("[scheduler] 중지됨");
}

export function schedulerStatus(): { running: boolean } {
  return { running: task !== null };
}
