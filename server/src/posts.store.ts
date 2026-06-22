import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "./config.js";
import { db } from "./db.js";
import { parseMarkdown } from "./markdown.js";
import type { Post } from "./types.js";

export interface CreatePostInput {
  /** 원본 마크다운 내용 */
  markdown: string;
  /** 제목 (미지정 시 front-matter -> 첫 헤딩 순으로 추론) */
  title?: string;
  tags?: string[];
  categoryId?: string;
  visibility?: Post["visibility"];
  scheduledAt?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function deriveTitle(markdown: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const parsed = parseMarkdown(markdown);
  if (parsed.title) return parsed.title;
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return "제목 없음";
}

export function listPosts(): Post[] {
  return [...db.data.posts].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getPost(id: string): Post | undefined {
  return db.data.posts.find((p) => p.id === id);
}

export async function readPostMarkdown(post: Post): Promise<string> {
  const filePath = path.join(config.paths.posts, post.fileName);
  return fs.readFile(filePath, "utf8");
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const id = nanoid(10);
  const fileName = `${id}.md`;
  await fs.writeFile(
    path.join(config.paths.posts, fileName),
    input.markdown,
    "utf8",
  );

  const parsed = parseMarkdown(input.markdown);
  const post: Post = {
    id,
    title: deriveTitle(input.markdown, input.title),
    fileName,
    tags: input.tags ?? parsed.tags ?? [],
    categoryId: input.categoryId,
    visibility: input.visibility ?? "public",
    scheduledAt: input.scheduledAt,
    status: input.scheduledAt ? "scheduled" : "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  db.data.posts.push(post);
  await db.write();
  return post;
}

export interface UpdatePostInput {
  title?: string;
  markdown?: string;
  tags?: string[];
  categoryId?: string | null;
  visibility?: Post["visibility"];
  /** null 을 주면 예약 해제(초안으로) */
  scheduledAt?: string | null;
}

export async function updatePost(
  id: string,
  input: UpdatePostInput,
): Promise<Post | undefined> {
  const post = getPost(id);
  if (!post) return undefined;

  if (typeof input.markdown === "string") {
    await fs.writeFile(
      path.join(config.paths.posts, post.fileName),
      input.markdown,
      "utf8",
    );
  }
  if (typeof input.title === "string") post.title = input.title.trim();
  if (input.tags) post.tags = input.tags;
  if (input.categoryId !== undefined)
    post.categoryId = input.categoryId ?? undefined;
  if (input.visibility) post.visibility = input.visibility;

  if (input.scheduledAt !== undefined) {
    if (input.scheduledAt === null) {
      post.scheduledAt = undefined;
      if (post.status === "scheduled") post.status = "draft";
    } else {
      post.scheduledAt = input.scheduledAt;
      // 발행 완료/실패가 아니면 다시 예약 상태로
      if (post.status === "draft" || post.status === "failed") {
        post.status = "scheduled";
      }
    }
  }

  post.updatedAt = nowIso();
  await db.write();
  return post;
}

export async function deletePost(id: string): Promise<boolean> {
  const idx = db.data.posts.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  const [post] = db.data.posts.splice(idx, 1);
  await db.write();
  try {
    await fs.unlink(path.join(config.paths.posts, post.fileName));
  } catch {
    // 파일이 이미 없으면 무시
  }
  return true;
}

/** 발행 상태 업데이트 헬퍼 */
export async function setPostStatus(
  id: string,
  status: Post["status"],
  extra: Partial<Pick<Post, "publishedUrl" | "lastError">> = {},
): Promise<void> {
  const post = getPost(id);
  if (!post) return;
  post.status = status;
  if (extra.publishedUrl !== undefined) post.publishedUrl = extra.publishedUrl;
  if (extra.lastError !== undefined) post.lastError = extra.lastError;
  post.updatedAt = nowIso();
  await db.write();
}
