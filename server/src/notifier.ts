import { config } from "./config.js";
import { db } from "./db.js";
import { checkSession } from "./tistory.js";
import { retryFailedPosts } from "./publisher.service.js";
import type { TelegramChannel } from "./types.js";

/**
 * 텔레그램 알림 / 상태 모니터링 모듈.
 *
 * - 일정 주기(TELEGRAM_NOTIFY_MINUTES, 기본 6시간)마다 로그인 여부·서버 상태·글 통계를
 *   점검해 텔레그램으로 보고한다.
 * - 로그인 상태가 "로그인됨 → 로그아웃" 으로 바뀌면 즉시 경고를 보낸다.
 * - 점검 중 로그인 상태이고 실패한 글이 있으면 자동 재발행을 트리거한다.
 * - 봇 토큰/채팅 ID 가 없으면 조용히 비활성화된다.
 */

let timer: NodeJS.Timeout | null = null;
let lastLoggedIn: boolean | null = null;
/** 채널별 마지막 전송 시각(ms). 주기 도래 판정에 사용. */
const lastSent = { heartbeat: 0, loginAlert: 0, failureAlert: 0 };

/** 토큰/채팅 ID 실효값: UI(DB) 우선, 비면 환경변수(config) 폴백. */
function effectiveAuth(): { botToken: string; chatId: string } {
  const t = db.data.telegram;
  return {
    botToken: t.botToken?.trim() || config.telegram.botToken,
    chatId: t.chatId?.trim() || config.telegram.chatId,
  };
}

export function telegramConfigured(): boolean {
  const { botToken, chatId } = effectiveAuth();
  return Boolean(botToken && chatId);
}

/** 텔레그램으로 메시지를 보낸다. 미설정/실패 시 false. */
export async function sendTelegram(text: string): Promise<boolean> {
  const { botToken, chatId } = effectiveAuth();
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      console.warn(`[telegram] 전송 실패: ${r.status} ${await r.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[telegram] 전송 오류:", err instanceof Error ? err.message : err);
    return false;
  }
}

export interface HealthReport {
  loggedIn: boolean;
  blogName: string;
  autopilotEnabled: boolean;
  scheduledCount: number;
  failedCount: number;
  publishedCount: number;
  checkedAt: string;
}

/** 현재 상태를 수집한다. check=true 면 실제 세션 유효성까지 점검(브라우저 사용). */
export async function collectHealth(check = true): Promise<HealthReport> {
  const { blogName } = db.data.settings;
  let loggedIn = db.data.settings.loggedIn;
  if (check && blogName) {
    try {
      loggedIn = await checkSession(blogName);
      db.data.settings.loggedIn = loggedIn;
      db.data.settings.lastLoginCheckAt = new Date().toISOString();
      await db.write();
    } catch {
      /* 점검 실패 시 마지막 알려진 값 유지 */
    }
  }
  const posts = db.data.posts;
  return {
    loggedIn,
    blogName,
    autopilotEnabled: db.data.autopilot.enabled,
    scheduledCount: posts.filter((p) => p.status === "scheduled").length,
    failedCount: posts.filter((p) => p.status === "failed").length,
    publishedCount: posts.filter((p) => p.status === "published").length,
    checkedAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
  };
}

function formatReport(h: HealthReport, title = "AutoBlog 상태 점검"): string {
  return [
    `<b>${title}</b>`,
    `서버: 정상 동작 중 ✅`,
    `로그인: ${h.loggedIn ? "로그인됨 ✅" : "로그아웃 ⚠️"}${
      h.blogName ? ` (${h.blogName})` : ""
    }`,
    `자동 발행: ${h.autopilotEnabled ? "켜짐" : "꺼짐"}`,
    `예약 대기 ${h.scheduledCount} · 실패 ${h.failedCount} · 발행완료 ${h.publishedCount}`,
    `점검 시각: ${h.checkedAt}`,
  ].join("\n");
}

/** 채널이 주기에 도래했는지 */
function isDue(ch: { enabled: boolean; intervalMinutes: number }, last: number): boolean {
  if (!ch.enabled) return false;
  const ms = Math.max(1, ch.intervalMinutes) * 60_000;
  return Date.now() - last >= ms;
}

/**
 * 1분마다 호출되는 마스터 틱.
 * 각 채널(정기 보고/로그인 경고/실패 알림)을 자신의 주기에 도래했을 때만 전송한다.
 */
async function masterTick(): Promise<void> {
  if (!telegramConfigured()) return;
  const t = db.data.telegram;
  const hbDue = isDue(t.heartbeat, lastSent.heartbeat);
  const loginDue = isDue(t.loginAlert, lastSent.loginAlert);
  const failDue = isDue(t.failureAlert, lastSent.failureAlert);
  if (!hbDue && !loginDue && !failDue) return;

  // 세션 점검은 비용이 있으므로 한 틱에 한 번만 수행
  const h = await collectHealth(true);
  const now = Date.now();

  if (hbDue) {
    await sendTelegram(formatReport(h));
    lastSent.heartbeat = now;
  }

  if (loginDue) {
    if (!h.loggedIn) {
      await sendTelegram(
        "⚠️ <b>로그인 세션이 만료되었습니다.</b>\n설정 탭에서 세션을 다시 가져오거나 재로그인해 주세요.",
      );
    } else if (lastLoggedIn === false) {
      // 직전엔 로그아웃이었는데 복구됨
      await sendTelegram("✅ <b>로그인 세션이 복구되었습니다.</b>");
    }
    lastSent.loginAlert = now;
  }
  lastLoggedIn = h.loggedIn;

  if (failDue) {
    if (h.failedCount > 0) {
      await sendTelegram(
        `⚠️ <b>발행 실패 글 ${h.failedCount}건</b>이 있습니다.${
          h.loggedIn ? "\n자동 재발행을 시도합니다." : "\n로그인 후 자동 재시도됩니다."
        }`,
      );
      if (h.loggedIn) void retryFailedPosts({ reason: "정기 점검" });
    }
    lastSent.failureAlert = now;
  }
}

/** 정기 상태 알림을 시작한다. (startup=false 면 시작 메시지 생략) */
export function startMonitor(startup = true): void {
  if (!telegramConfigured()) {
    console.log("[monitor] 텔레그램 미설정 → 상태 알림 비활성화");
    return;
  }
  if (timer) return;
  // 시작 직후 즉시 폭주하지 않도록 기준 시각을 현재로 초기화
  const now = Date.now();
  lastSent.heartbeat = now;
  lastSent.loginAlert = now;
  lastSent.failureAlert = now;
  // 1분 단위 마스터 틱 (채널별 주기는 틱 안에서 판정)
  timer = setInterval(() => void masterTick(), 60_000);
  const t = db.data.telegram;
  console.log(
    `[monitor] 텔레그램 알림 시작 — 정기보고 ${t.heartbeat.intervalMinutes}분 / 로그인 ${t.loginAlert.intervalMinutes}분 / 실패 ${t.failureAlert.intervalMinutes}분`,
  );
  if (startup && t.heartbeat.enabled) {
    void sendTelegram(
      "🚀 <b>AutoBlog 서버 시작됨</b>\n상태 모니터링을 시작합니다.",
    );
  }
}

export function stopMonitor(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** 설정(채널/주기/토큰 등) 변경 후 모니터를 재시작한다. */
export function restartMonitor(): void {
  stopMonitor();
  startMonitor(false);
}

/** 수동 테스트: 현재 상태를 즉시 점검해 텔레그램으로 보낸다. */
export async function sendTestNotification(): Promise<boolean> {
  if (!telegramConfigured()) return false;
  const h = await collectHealth(true);
  return sendTelegram(formatReport(h, "🔔 (테스트) AutoBlog 상태"));
}

export interface MonitorStatus {
  configured: boolean;
  running: boolean;
  /** 봇 토큰이 저장돼 있는지 (값은 노출하지 않음) */
  hasToken: boolean;
  /** 채팅 ID (비밀이 아니므로 표시) */
  chatId: string;
  /** 환경변수(.env)로 설정돼 있는지 — UI 입력이 없을 때 폴백됨 */
  fromEnv: boolean;
  /** 채널별 on/off + 주기 */
  heartbeat: TelegramChannel;
  loginAlert: TelegramChannel;
  failureAlert: TelegramChannel;
}

export function monitorStatus(): MonitorStatus {
  const eff = effectiveAuth();
  const t = db.data.telegram;
  return {
    configured: Boolean(eff.botToken && eff.chatId),
    running: timer !== null,
    hasToken: Boolean(eff.botToken),
    chatId: t.chatId || config.telegram.chatId,
    fromEnv: Boolean(!t.botToken && config.telegram.botToken),
    heartbeat: t.heartbeat,
    loginAlert: t.loginAlert,
    failureAlert: t.failureAlert,
  };
}
