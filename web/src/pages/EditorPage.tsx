import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Post } from "../api.ts";
import { isoToLocalInput, localInputToIso } from "../lib.ts";

export default function EditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<Post["visibility"]>("public");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.getPost(id).then((p) => {
      setTitle(p.title);
      setMarkdown(p.markdown);
      setTags(p.tags.join(", "));
      setVisibility(p.visibility);
      setScheduledAt(isoToLocalInput(p.scheduledAt));
    });
  }, [id]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setMarkdown(text);
    if (!title) setTitle(file.name.replace(/\.md$/i, ""));
  };

  const save = async () => {
    setError("");
    if (!markdown.trim()) {
      setError("본문(마크다운)을 입력해 주세요.");
      return;
    }
    setSaving(true);
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const iso = localInputToIso(scheduledAt) ?? null;

    try {
      if (isEdit && id) {
        await api.updatePost(id, {
          title: title || undefined,
          markdown,
          tags: tagList,
          visibility,
          scheduledAt: iso,
        });
      } else {
        await api.createPost({
          title: title || undefined,
          markdown,
          tags: tagList,
          visibility,
          scheduledAt: iso ?? undefined,
        });
      }
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {isEdit ? "글 편집" : "새 글 작성"}
        </h2>
        {!isEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
            >
              .md 파일 불러오기
            </button>
          </>
        )}
      </div>

      <Field label="제목">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="비우면 본문 첫 제목/파일명에서 추론"
          className="input"
        />
      </Field>

      <Field label="본문 (Markdown)">
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          rows={16}
          placeholder="# 제목&#10;&#10;마크다운으로 작성하세요..."
          className="input font-mono text-sm leading-relaxed"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="태그 (콤마 구분)">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="개발, 티스토리"
            className="input"
          />
        </Field>
        <Field label="공개 범위">
          <select
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as Post["visibility"])
            }
            className="input"
          >
            <option value="public">공개</option>
            <option value="protected">보호</option>
            <option value="private">비공개</option>
          </select>
        </Field>
        <Field label="예약 발행 시각">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "저장 중..." : scheduledAt ? "예약 저장" : "저장"}
        </button>
        <button
          onClick={() => navigate("/")}
          className="rounded-lg border border-slate-700 px-5 py-2 text-sm hover:bg-slate-800"
        >
          취소
        </button>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          color: #e5e7eb;
          outline: none;
        }
        .input:focus { border-color: #6366f1; }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}
