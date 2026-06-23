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

const updateSchema = z.object({
  /** 빈 문자열/미지정이면 기존 토큰 유지 */
  botToken: z.string().optional(),
  chatId: z.string().optional(),
  heartbeat: channelSchema,
  loginAlert: channelSchema,
  failureAlert: channelSchema,
});

// 텔레그램 설정 저장 (화면 입력). 저장 후 모니터 재시작.
monitorRouter.put("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const d = parsed.data;
  const t = db.data.telegram;
  // 토큰은 비워서 보내면 기존 값 유지(노출 안 하므로). 명시적으로 지우려면 "-" 입력.
  if (d.botToken !== undefined) {
    const v = d.botToken.trim();
    if (v === "-") t.botToken = "";
    else if (v !== "") t.botToken = v;
  }
  if (d.chatId !== undefined) t.chatId = d.chatId.trim();

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
