import { useEffect, useState } from "react";
import {
  api,
  type AutopilotConfig,
  type KeywordPlan,
  type Post,
  type ProviderStatus,
} from "../api.ts";
import { formatDateTime } from "../lib.ts";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI (ChatGPT)",
  gemini: "Google Gemini",
};

export default function AutopilotPage() {
  const [cfg, setCfg] = useState<AutopilotConfig | null>(null);
  const [plan, setPlan] = useState<KeywordPlan | null>(null);
  const [aiStatus, setAiStatus] = useState<ProviderStatus[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const load = () =>
    api.getAutopilot().then((s) => {
      setCfg(s.config);
      setPlan(s.plan);
    });

  const loadStatus = () =>
    api.getAiStatus().then((s) => setAiStatus(s.providers)).catch(() => {});

  useEffect(() => {
    load();
    loadStatus();
  }, []);

  if (!cfg) return <p className="text-slate-400">불러오는 중...</p>;

  const patch = (p: Partial<AutopilotConfig>) =>
    setCfg({ ...cfg, ...p } as AutopilotConfig);

  const save = async () => {
    setBusy("save");
    setMsg("");
    try {
      const r = await api.updateAutopilot({
        enabled: cfg.enabled,
        topic: cfg.topic,
        audience: cfg.audience,
        postsPerDay: cfg.postsPerDay,
        hour: cfg.hour,
        minute: cfg.minute,
        visibility: cfg.visibility,
        openai: {
          model: cfg.openai.model,
          baseUrl: cfg.openai.baseUrl ?? "",
        },
        gemini: { model: cfg.gemini.model },
      });
      setCfg(r.config);
      setPlan(r.plan);
      setMsg("설정을 저장했습니다.");
      loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy("");
    }
  };

  const checkAi = async () => {
    setBusy("check");
    setMsg("각 AI 에 상태 확인 요청 중...");
    try {
      const r = await api.checkAi();
      setAiStatus(r.providers);
      setMsg("AI 상태를 갱신했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "확인 실패");
    } finally {
      setBusy("");
    }
  };

  const regen = async () => {
    if (!confirm("이번 달 키워드를 새로 생성할까요? (기존 계획은 대체됩니다)")) return;
    setBusy("regen");
    setMsg("AI 가 키워드를 선정하는 중...");
    try {
      const r = await api.regenerateKeywords();
      setPlan(r.plan);
      setMsg(`키워드 ${r.count}개를 생성했습니다.`);
      loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "키워드 생성 실패");
    } finally {
      setBusy("");
    }
  };

  const runNow = async () => {
    if (!confirm(`지금 AI 로 새 글 ${cfg.postsPerDay}개를 생성해 발행할까요?`)) return;
    setBusy("run");
    setMsg("AI 글 생성 및 발행 중... (브라우저 창이 뜰 수 있습니다)");
    try {
      const r = await api.runAutopilot();
      setMsg(`실행 결과: ${r.summary}`);
      load();
      loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "실행 실패");
    } finally {
      setBusy("");
    }
  };

  const publishExisting = async () => {
    if (
      !confirm(
        `AI 호출 없이, 이미 만들어진 미발행 글 중 ${cfg.postsPerDay}개를 지금 발행할까요?`,
      )
    )
      return;
    setBusy("runExisting");
    setMsg("기존 글 발행 중... (브라우저 창이 뜰 수 있습니다)");
    try {
      const r = await api.runAutopilotExisting();
      setMsg(`실행 결과: ${r.summary}`);
      load();
      loadStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "실행 실패");
    } finally {
      setBusy("");
    }
  };

  const usedCount = plan?.keywords.filter((k) => k.used).length ?? 0;

  const availabilityBadge = (a: boolean | null) =>
    a === true
      ? { text: "사용 가능", cls: "bg-emerald-500/20 text-emerald-300" }
      : a === false
        ? { text: "사용 불가", cls: "bg-red-500/20 text-red-300" }
        : { text: "미확인", cls: "bg-slate-600/40 text-slate-300" };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">자동 발행 (AI)</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="h-4 w-4"
          />
          자동 발행 {cfg.enabled ? "켜짐" : "꺼짐"}
        </label>
      </div>

      <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-400">
        매달 AI 가 수익형 키워드를 선정하고, 매일 <b>{cfg.hour}시 {String(cfg.minute).padStart(2, "0")}분</b>에
        <b> {cfg.postsPerDay}개</b>의 글을 생성해 자동 발행합니다. OpenAI·Gemini 중 <b>토큰이 남아 호출에 성공하는 쪽</b>을
        자동으로 사용하며, 한쪽이 실패하면 다른 쪽으로 전환합니다.
      </p>

      {/* 수동 실행: 예약 시각과 무관하게 이미 만들어진 글을 바로 발행 (AI 호출 없음) */}
      <section className="flex flex-col gap-3 rounded-xl border border-emerald-700/40 bg-emerald-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-medium text-emerald-200">지금 즉시 발행</h3>
          <p className="mt-1 text-sm text-slate-400">
            예약 시각·AI 와 무관하게, <b>이미 만들어진 미발행 글</b> 중 오래된 순으로
            <b> {cfg.postsPerDay}개</b>를 바로 발행합니다. (새 글 생성 없음)
          </p>
        </div>
        <button
          disabled={busy === "runExisting"}
          onClick={publishExisting}
          className="shrink-0 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy === "runExisting" ? "발행 중..." : "지금 즉시 발행"}
        </button>
      </section>

      {/* AI 상태 / 사용량 */}
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">AI 상태 · 사용량</h3>
          <button
            disabled={busy === "check"}
            onClick={checkAi}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "check" ? "확인 중..." : "상태 확인"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          ※ OpenAI/Gemini 는 잔여 토큰(잔액) 조회 API 를 제공하지 않아, 누적 사용량과 마지막 호출 성공 여부로 표시합니다.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {aiStatus.map((s) => {
            const b = availabilityBadge(s.available);
            return (
              <div
                key={s.provider}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{PROVIDER_LABEL[s.provider]}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${b.cls}`}>
                    {s.configured ? b.text : "키 없음"}
                  </span>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                  <div>모델: {s.model}</div>
                  <div>누적 사용 토큰: {s.usedTokens.toLocaleString()}</div>
                  <div>요청 수: {s.requests.toLocaleString()}</div>
                  {s.lastError && (
                    <div className="text-red-400">오류: {s.lastError}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <Field label="블로그 주제 / 니치">
          <input
            value={cfg.topic}
            onChange={(e) => patch({ topic: e.target.value })}
            placeholder="예: 재테크·금융 정보, 건강·다이어트, IT 기기 리뷰 ..."
            className="ap-input"
          />
        </Field>
        <Field label="타깃 독자 (선택)">
          <input
            value={cfg.audience}
            onChange={(e) => patch({ audience: e.target.value })}
            placeholder="예: 2030 직장인, 초보 투자자"
            className="ap-input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="하루 발행 수">
            <input
              type="number"
              min={1}
              max={10}
              value={cfg.postsPerDay}
              onChange={(e) => patch({ postsPerDay: Number(e.target.value) })}
              className="ap-input"
            />
          </Field>
          <Field label="시(0-23)">
            <input
              type="number"
              min={0}
              max={23}
              value={cfg.hour}
              onChange={(e) => patch({ hour: Number(e.target.value) })}
              className="ap-input"
            />
          </Field>
          <Field label="분(0-59)">
            <input
              type="number"
              min={0}
              max={59}
              value={cfg.minute}
              onChange={(e) => patch({ minute: Number(e.target.value) })}
              className="ap-input"
            />
          </Field>
          <Field label="공개 범위">
            <select
              value={cfg.visibility}
              onChange={(e) =>
                patch({ visibility: e.target.value as Post["visibility"] })
              }
              className="ap-input"
            >
              <option value="public">공개</option>
              <option value="protected">보호</option>
              <option value="private">비공개</option>
            </select>
          </Field>
        </div>

        {/* API 키 안내: 키는 서버 환경변수(.env)로만 관리 */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
          <b className="text-slate-300">API 키는 서버 환경변수(.env)로 설정합니다.</b>{" "}
          민감정보 보호를 위해 화면/설정 파일에 저장하지 않습니다.
          <span className="mt-1 block">
            OpenAI(<code>OPENAI_API_KEY</code>):{" "}
            <span className={cfg.openai.hasApiKey ? "text-emerald-400" : "text-amber-400"}>
              {cfg.openai.hasApiKey ? "설정됨" : "미설정"}
            </span>
            {"  ·  "}
            Gemini(<code>GEMINI_API_KEY</code>):{" "}
            <span className={cfg.gemini.hasApiKey ? "text-emerald-400" : "text-amber-400"}>
              {cfg.gemini.hasApiKey ? "설정됨" : "미설정"}
            </span>
          </span>
        </div>

        {/* OpenAI */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="OpenAI 모델">
            <input
              value={cfg.openai.model}
              onChange={(e) =>
                patch({ openai: { ...cfg.openai, model: e.target.value } })
              }
              placeholder="gpt-4o-mini"
              className="ap-input"
            />
          </Field>
          <Field label="OpenAI Base URL (선택 · OAuth 프록시)">
            <input
              value={cfg.openai.baseUrl ?? ""}
              onChange={(e) =>
                patch({ openai: { ...cfg.openai, baseUrl: e.target.value } })
              }
              placeholder="http://127.0.0.1:10531/v1"
              className="ap-input"
            />
            <p className="mt-1 text-xs text-slate-500">
              ChatGPT 계정으로 API 키 없이 쓰려면 <code>npx openai-oauth</code> 프록시 주소를 입력하세요.
              이때 모델은 <code>gpt-5.4</code> 등 Codex 플랜 모델을 사용합니다. 비우면 공식 API 사용.
            </p>
          </Field>
        </div>

        {/* Gemini */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Gemini 모델">
            <input
              value={cfg.gemini.model}
              onChange={(e) =>
                patch({ gemini: { ...cfg.gemini, model: e.target.value } })
              }
              placeholder="gemini-2.5-flash"
              className="ap-input"
            />
          </Field>
        </div>

        <button
          disabled={busy === "save"}
          onClick={save}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "save" ? "저장 중..." : "설정 저장"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">
            이번 달 키워드 계획
            {plan && (
              <span className="ml-2 text-sm text-slate-400">
                {plan.month} · {usedCount}/{plan.keywords.length} 사용
              </span>
            )}
          </h3>
          <div className="flex gap-2">
            <button
              disabled={busy === "regen"}
              onClick={regen}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === "regen" ? "생성 중..." : "키워드 생성/재생성"}
            </button>
            <button
              disabled={busy === "run"}
              onClick={runNow}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "run" ? "생성 중..." : "AI 생성 후 1회 실행"}
            </button>
          </div>
        </div>

        {!plan || plan.keywords.length === 0 ? (
          <p className="text-sm text-slate-400">
            아직 키워드 계획이 없습니다. 주제를 저장한 뒤 "키워드 생성"을 눌러주세요.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-auto">
            {plan.keywords.map((k, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-800/50"
              >
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-xs ${
                    k.used
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-600/40 text-slate-300"
                  }`}
                >
                  {k.used ? "사용" : "대기"}
                </span>
                <div>
                  <span className="font-medium">{k.keyword}</span>
                  {k.rationale && (
                    <span className="block text-xs text-slate-500">
                      {k.rationale}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(cfg.lastRunResult || cfg.lastRunAt) && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm">
          <p className="text-slate-400">
            마지막 실행: {formatDateTime(cfg.lastRunAt)}
          </p>
          {cfg.lastRunResult && (
            <p className="mt-1 text-slate-300">{cfg.lastRunResult}</p>
          )}
        </section>
      )}

      {msg && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
          {msg}
        </p>
      )}

      <style>{`
        .ap-input {
          width: 100%;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          color: #e5e7eb;
          outline: none;
        }
        .ap-input:focus { border-color: #6366f1; }
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
