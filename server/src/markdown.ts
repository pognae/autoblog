import { marked } from "marked";
import matter from "gray-matter";

export interface ParsedMarkdown {
  /** front-matter 의 title (있으면) */
  title?: string;
  tags?: string[];
  category?: string;
  /** front-matter 를 제거한 순수 본문 마크다운 */
  body: string;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * 마크다운 파일 내용을 파싱한다.
 * front-matter(--- 블록)가 있으면 메타데이터를 추출한다.
 */
export function parseMarkdown(raw: string): ParsedMarkdown {
  const { data, content } = matter(raw);
  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === "string"
      ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : undefined;

  return {
    title: typeof data.title === "string" ? data.title : undefined,
    tags,
    category: typeof data.category === "string" ? data.category : undefined,
    body: content.trim(),
  };
}

/** 마크다운 본문을 티스토리에 넣을 HTML 로 변환한다. */
export async function markdownToHtml(body: string): Promise<string> {
  return marked.parse(body, { async: true });
}
