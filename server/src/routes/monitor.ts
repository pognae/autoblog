import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  monitorStatus,
  restartMonitor,
  sendTestNotification,
} from "../notifier.js";
import { savePersistedConfig } from "../config.store.js";

export const monitorRouter = Router();

// 텔레그램 알림 설정/동작 상태
monitorRouter.get("/", (_req, res) => {
  res.json(monitorStatus());
});

const channelSchema = z
  .object({
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).max(1440).optional(),
  })
  .optional();

// 봇 토큰/채팅 ID 는 .env 에서만 관리하므로 화면에서 받지 않는다.
// 여기서는 종류별 on/off + 주기만 저장한다.
const updateSchema = z.object({
  heartbeat: channelSchema,
  loginAlert: channelSchema,
  failureAlert: channelSchema,
});

// 텔레그램 알림 설정 저장 (화면 입력). 저장 후 모니터 재시작.
monitorRouter.put("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const d = parsed.data;
  const t = db.data.telegram;

  for (const key of ["heartbeat", "loginAlert", "failureAlert"] as const) {
    const c = d[key];
    if (!c) continue;
    if (c.enabled !== undefined) t[key].enabled = c.enabled;
    if (c.intervalMinutes !== undefined) t[key].intervalMinutes = c.intervalMinutes;
  }

  await db.write();
  savePersistedConfig();

  restartMonitor();
  res.json(monitorStatus());
});

// 테스트 알림 즉시 전송
monitorRouter.post("/test", async (_req, res) => {
  const status = monitorStatus();
  if (!status.configured) {
    return res.status(400).json({
      error:
        "텔레그램이 설정되지 않았습니다. TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 환경변수를 설정하세요.",
    });
  }
  const ok = await sendTestNotification();
  res.json({ ok });
});
