import fs from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db.js";
import { checkSession, loginInteractive } from "../tistory.js";
import { retryFailedPosts } from "../publisher.service.js";
import { savePersistedConfig } from "../config.store.js";

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
  savePersistedConfig();
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
  // 재로그인 성공 시, 그동안 실패한 글들을 백그라운드에서 순차 재발행
  if (result.success) {
    void retryFailedPosts({ reason: "재로그인" });
  }
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
  if (ok) void retryFailedPosts({ reason: "세션 확인" });
  res.json(db.data.settings);
});

/**
 * 세션 내보내기: 현재 로그인 세션(state.json)을 다운로드한다.
 * 클라우드(원격) 서버는 직접 로그인 창을 띄울 수 없으므로,
 * 로컬에서 로그인한 뒤 이 파일을 받아 클라우드로 "가져오기" 한다.
 */
settingsRouter.get("/session/export", (_req, res) => {
  if (!fs.existsSync(config.paths.state)) {
    return res.status(404).json({ error: "저장된 로그인 세션이 없습니다. 먼저 로그인해 주세요." });
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="tistory-session.json"',
  );
  res.send(fs.readFileSync(config.paths.state, "utf-8"));
});

/**
 * 세션 가져오기: 로컬에서 내보낸 state.json 내용을 받아 저장한다.
 * 저장 후 세션 유효성까지 확인해 loggedIn 을 갱신한다.
 */
settingsRouter.post("/session/import", async (req, res) => {
  const body = req.body as unknown;
  // storageState 형식 최소 검증 (cookies 배열 존재)
  const valid =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { cookies?: unknown }).cookies);
  if (!valid) {
    return res
      .status(400)
      .json({ error: "올바른 세션 파일이 아닙니다. (cookies 배열이 필요)" });
  }
  try {
    fs.mkdirSync(config.paths.session, { recursive: true });
    fs.writeFileSync(config.paths.state, JSON.stringify(body), "utf-8");
  } catch (err) {
    return res.status(500).json({
      error: `세션 저장 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const { blogName } = db.data.settings;
  // 블로그 이름이 있으면 즉시 유효성 확인, 없으면 일단 저장만 하고 로그인 표시
  const ok = blogName ? await checkSession(blogName) : true;
  db.data.settings.loggedIn = ok;
  db.data.settings.lastLoginCheckAt = new Date().toISOString();
  await db.write();
  if (ok) void retryFailedPosts({ reason: "세션 가져오기" });
  res.json({ ...db.data.settings, imported: true });
});
