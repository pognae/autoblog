import { db } from "./db.js";
import {
  getPost,
  readPostMarkdown,
  setPostStatus,
} from "./posts.store.js";
import { markdownToHtml, parseMarkdown } from "./markdown.js";
import { publishPost as tistoryPublish } from "./tistory.js";

/** 동시에 여러 브라우저가 뜨지 않도록 직렬화 */
let publishingChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = publishingChain.then(task, task);
  publishingChain = next.catch(() => {});
  return next;
}

export interface PublishOutcome {
  ok: boolean;
  url?: string;
  error?: string;
}

/** 특정 글을 즉시 발행한다. (스케줄러/수동 발행 공용) */
export async function publishPostById(id: string): Promise<PublishOutcome> {
  return enqueue(async () => {
    const post = getPost(id);
    if (!post) return { ok: false, error: "글을 찾을 수 없습니다." };

    const { blogName, loggedIn } = db.data.settings;
    if (!blogName) {
      const error = "블로그 이름이 설정되지 않았습니다.";
      await setPostStatus(id, "failed", { lastError: error });
      return { ok: false, error };
    }
    if (!loggedIn) {
      const error = "티스토리 로그인이 필요합니다.";
      await setPostStatus(id, "failed", { lastError: error });
      return { ok: false, error };
    }

    await setPostStatus(id, "publishing", { lastError: "" });

    try {
      const raw = await readPostMarkdown(post);
      const parsed = parseMarkdown(raw);
      const html = await markdownToHtml(parsed.body);
      const result = await tistoryPublish({
        blogName,
        title: post.title,
        markdown: parsed.body,
        html,
        tags: post.tags,
        categoryId: post.categoryId,
        visibility: post.visibility,
      });
      await setPostStatus(id, "published", { publishedUrl: result.url });
      return { ok: true, url: result.url };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await setPostStatus(id, "failed", { lastError: error });
      return { ok: false, error };
    }
  });
}
