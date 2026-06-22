import { Router } from "express";
import { db } from "../db.js";
import { checkAllProviders, getAiStatus } from "../ai.js";

export const aiRouter = Router();

/** AI 제공자별 상태/사용량 */
aiRouter.get("/", (_req, res) => {
  res.json({ providers: getAiStatus(db.data.autopilot) });
});

/** 각 제공자에 가벼운 핑을 보내 사용 가능 여부 갱신 */
aiRouter.post("/check", async (_req, res) => {
  await checkAllProviders(db.data.autopilot);
  res.json({ providers: getAiStatus(db.data.autopilot) });
});
