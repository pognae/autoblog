import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Post } from "../api.ts";
import { STATUS_COLOR, STATUS_LABEL, formatDateTime } from "../lib.ts";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () =>
    api
      .listPosts()
      .then(setPosts)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // 발행 상태 자동 갱신
    return () => clearInterval(t);
  }, []);

  const onPublish = async (id: string) => {
    if (!confirm("지금 바로 발행할까요?")) return;
    setBusyId(id);
    try {
      const r = await api.publishNow(id);
      if (!r.ok) alert(`발행 실패: ${r.error}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "발행 실패");
    } finally {
      setBusyId(null);
      load();
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("이 글을 삭제할까요?")) return;
    await api.deletePost(id);
    load();
  };

  if (loading) return <p className="text-slate-400">불러오는 중...</p>;

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center">
        <p className="mb-4 text-slate-400">아직 등록된 글이 없습니다.</p>
        <button
          onClick={() => navigate("/new")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          첫 글 작성하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status]}`}
              >
                {STATUS_LABEL[p.status]}
              </span>
              <h3 className="truncate font-medium">{p.title}</h3>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {p.scheduledAt
                ? `예약: ${formatDateTime(p.scheduledAt)}`
                : `수정: ${formatDateTime(p.updatedAt)}`}
              {p.tags.length > 0 && (
                <span className="ml-2">· {p.tags.map((t) => `#${t}`).join(" ")}</span>
              )}
            </div>
            {p.status === "failed" && p.lastError && (
              <p className="mt-1 text-xs text-red-400">⚠ {p.lastError}</p>
            )}
            {p.publishedUrl && (
              <a
                href={p.publishedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-indigo-400 hover:underline"
              >
                {p.publishedUrl}
              </a>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Link
              to={`/edit/${p.id}`}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            >
              편집
            </Link>
            <button
              disabled={busyId === p.id || p.status === "publishing"}
              onClick={() => onPublish(p.id)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {busyId === p.id ? "발행 중..." : "즉시 발행"}
            </button>
            <button
              onClick={() => onDelete(p.id)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-red-300 hover:bg-slate-800"
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
