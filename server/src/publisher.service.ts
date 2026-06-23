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

let retrying = false;

/**
 * 발행에 실패한 글들을 순차적으로 다시 발행한다.
 * - 서버 재시작/재로그인/세션 가져오기 직후에 호출되어 누락 발행을 복구한다.
 * - 로그인 상태가 아니면(또는 블로그 이름 미설정) 아무것도 하지 않는다.
 * - `includeStuck` 이면 서버가 발행 도중 멈춰 'publishing' 으로 남은 글도 대상에 포함한다.
 * - 발행 자체는 publishPostById 가 직렬화하므로 순차 실행이 보장된다.
 */
export async function retryFailedPosts(
  opts: { includeStuck?: boolean; reason?: string } = {},
): Promise<PublishOutcome[]> {
  const { blogName, loggedIn } = db.data.settings;
  if (!blogName || !loggedIn) return [];
  if (retrying) return []; // 중복 재시도 방지
  retrying = true;
  try {
    const statuses: Array<string> = opts.includeStuck
      ? ["failed", "publishing"]
      : ["failed"];
    const targets = db.data.posts
      .filter((p) => statuses.includes(p.status))
      .sort(
        (a, b) =>
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      );
    if (targets.length === 0) return [];

    console.log(
      `[retry] 실패 글 ${targets.length}건 재발행 시작${
        opts.reason ? ` (${opts.reason})` : ""
      }`,
    );
    const results: PublishOutcome[] = [];
    for (const post of targets) {
      console.log(`[retry] 재발행: ${post.title} (${post.id})`);
      const r = await publishPostById(post.id);
      results.push(r);
      // 로그인 세션이 만료된 상태면 이후 글도 모두 실패하므로 조기 종료
      if (!r.ok && /세션이 만료|로그인/.test(r.error ?? "")) {
        console.warn("[retry] 세션 만료 감지 → 재발행 중단");
        break;
      }
    }
    console.log("[retry] 재발행 완료");
    return results;
  } finally {
    retrying = false;
  }
}
