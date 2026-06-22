import type { PostStatus } from "./api.ts";

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "초안",
  scheduled: "예약됨",
  publishing: "발행 중",
  published: "발행 완료",
  failed: "실패",
};

export const STATUS_COLOR: Record<PostStatus, string> = {
  draft: "bg-slate-600/40 text-slate-300",
  scheduled: "bg-amber-500/20 text-amber-300",
  publishing: "bg-blue-500/20 text-blue-300",
  published: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-red-500/20 text-red-300",
};

export function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** datetime-local 입력값(로컬) -> ISO 문자열 */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** ISO -> datetime-local 입력값 (로컬 타임존 보정) */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}
