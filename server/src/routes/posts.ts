import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  readPostMarkdown,
  updatePost,
} from "../posts.store.js";
import { markdownToHtml } from "../markdown.js";
import { publishPostById } from "../publisher.service.js";

export const postsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const visibilityEnum = z.enum(["public", "protected", "private"]);

const createSchema = z.object({
  markdown: z.string().min(1, "마크다운 내용이 비어 있습니다."),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  visibility: visibilityEnum.optional(),
  scheduledAt: z.string().datetime().optional(),
});

postsRouter.get("/", (_req, res) => {
  res.json(listPosts());
});

postsRouter.get("/:id", async (req, res) => {
  const post = getPost(req.params.id);
  if (!post) return res.status(404).json({ error: "글을 찾을 수 없습니다." });
  const markdown = await readPostMarkdown(post);
  const html = await markdownToHtml(markdown);
  res.json({ ...post, markdown, html });
});

// JSON 본문으로 생성
postsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const post = await createPost(parsed.data);
  res.status(201).json(post);
});

// .md 파일 업로드로 생성 (multipart)
postsRouter.post("/upload", upload.array("files"), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "업로드된 파일이 없습니다." });
  }
  const scheduledAt =
    typeof req.body.scheduledAt === "string" && req.body.scheduledAt
      ? req.body.scheduledAt
      : undefined;

  const created = [];
  for (const file of files) {
    const markdown = file.buffer.toString("utf8");
    const title = file.originalname.replace(/\.md$/i, "");
    created.push(await createPost({ markdown, title, scheduledAt }));
  }
  res.status(201).json(created);
});

const updateSchema = z.object({
  title: z.string().optional(),
  markdown: z.string().optional(),
  tags: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  visibility: visibilityEnum.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

postsRouter.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message });
  }
  const post = await updatePost(req.params.id, parsed.data);
  if (!post) return res.status(404).json({ error: "글을 찾을 수 없습니다." });
  res.json(post);
});

postsRouter.delete("/:id", async (req, res) => {
  const ok = await deletePost(req.params.id);
  if (!ok) return res.status(404).json({ error: "글을 찾을 수 없습니다." });
  res.status(204).end();
});

// 즉시 발행
postsRouter.post("/:id/publish", async (req, res) => {
  const result = await publishPostById(req.params.id);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});
