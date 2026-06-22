import { Router } from "express";
import {
  schedulerStatus,
  startScheduler,
  stopScheduler,
} from "../scheduler.js";

export const schedulerRouter = Router();

schedulerRouter.get("/", (_req, res) => {
  res.json(schedulerStatus());
});

schedulerRouter.post("/start", (_req, res) => {
  startScheduler();
  res.json(schedulerStatus());
});

schedulerRouter.post("/stop", (_req, res) => {
  stopScheduler();
  res.json(schedulerStatus());
});
