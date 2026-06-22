import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDb } from "./db.js";
import { startScheduler } from "./scheduler.js";
import { startAutopilot } from "./autopilot.js";
import { postsRouter } from "./routes/posts.js";
import { settingsRouter } from "./routes/settings.js";
import { schedulerRouter } from "./routes/scheduler.js";
import { autopilotRouter } from "./routes/autopilot.js";
import { aiRouter } from "./routes/ai.js";

async function main(): Promise<void> {
  await initDb();

  const app = express();
  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/posts", postsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/scheduler", schedulerRouter);
  app.use("/api/autopilot", autopilotRouter);
  app.use("/api/ai", aiRouter);

  // 공통 에러 핸들러
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[error]", err);
      const message = err instanceof Error ? err.message : "서버 오류";
      res.status(500).json({ error: message });
    },
  );

  // 프로덕션: 빌드된 프론트엔드(web/dist)를 같은 서버에서 서빙한다.
  // (클라우드에 단일 서비스로 배포 → 같은 출처라 CORS 불필요)
  const indexHtml = path.join(config.paths.webDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.paths.webDist));
    // SPA 폴백: /api 가 아닌 모든 GET 요청은 index.html 로
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexHtml));
    console.log("[server] 프론트엔드 정적 서빙 활성화 (web/dist)");
  }

  // 0.0.0.0 바인딩: 클라우드(cloudtype 등) 컨테이너에서 외부 접근 허용
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[server] http://localhost:${config.port} 에서 실행 중`);
    if (config.scheduler.autoStart) startScheduler();
    startAutopilot();
  });
}

main().catch((err) => {
  console.error("서버 시작 실패:", err);
  process.exit(1);
});
