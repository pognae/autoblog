import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { checkSession, loginInteractive } from "../tistory.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json(db.data.settings);
});

const updateSchema = z.object({
  blogName: z.string().trim().min(1).optional(),
});

settingsRouter.put("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "블로그 이름을 입력해 주세요." });
  }
  if (parsed.data.blogName !== undefined) {
    db.data.settings.blogName = parsed.data.blogName;
  }
  await db.write();
  res.json(db.data.settings);
});

/**
 * 헤드풀 브라우저를 띄워 사용자가 직접 로그인하도록 한다.
 * 로그인 완료/실패까지 동기적으로 기다린 뒤 결과를 반환한다.
 */
settingsRouter.post("/login", async (_req, res) => {
  const { blogName } = db.data.settings;
  if (!blogName) {
    return res.status(400).json({ error: "먼저 블로그 이름을 설정해 주세요." });
  }
  const result = await loginInteractive(blogName, (msg) =>
    console.log(`[login] ${msg}`),
  );
  db.data.settings.loggedIn = result.success;
  db.data.settings.lastLoginCheckAt = new Date().toISOString();
  await db.write();
  res.json({ ...db.data.settings, success: result.success });
});

/** 저장된 세션이 아직 유효한지 점검 */
settingsRouter.post("/check-session", async (_req, res) => {
  const { blogName } = db.data.settings;
  if (!blogName) {
    return res.status(400).json({ error: "먼저 블로그 이름을 설정해 주세요." });
  }
  const ok = await checkSession(blogName);
  db.data.settings.loggedIn = ok;
  db.data.settings.lastLoginCheckAt = new Date().toISOString();
  await db.write();
  res.json(db.data.settings);
});
