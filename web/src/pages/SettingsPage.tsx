import { useEffect, useState } from "react";
import { api, type Settings } from "../api.ts";
import { formatDateTime } from "../lib.ts";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blogName, setBlogName] = useState("");
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const load = () =>
    api.getSettings().then((s) => {
      setSettings(s);
      setBlogName(s.blogName);
    });

  useEffect(() => {
    load();
  }, []);

  const saveBlogName = async () => {
    setBusy("save");
    setMsg("");
    try {
      const s = await api.updateSettings({ blogName: blogName.trim() });
      setSettings(s);
      setMsg("블로그 이름을 저장했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy("");
    }
  };

  const login = async () => {
    setBusy("login");
    setMsg("브라우저 창에서 티스토리 로그인을 완료해 주세요...");
    try {
      const s = await api.login();
      setSettings(s);
      setMsg(s.success ? "로그인 성공! 세션이 저장되었습니다." : "로그인에 실패했거나 시간이 초과되었습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "로그인 실패");
    } finally {
      setBusy("");
    }
  };

  const check = async () => {
    setBusy("check");
    setMsg("");
    try {
      const s = await api.checkSession();
      setSettings(s);
      setMsg(s.loggedIn ? "세션이 유효합니다." : "세션이 만료되었습니다. 다시 로그인하세요.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "확인 실패");
    } finally {
      setBusy("");
    }
  };

  const exportSession = async () => {
    setBusy("export");
    setMsg("");
    try {
      await api.exportSession();
      setMsg("세션 파일을 내려받았습니다. 클라우드 서버의 설정에서 '세션 가져오기'로 업로드하세요.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "내보내기 실패");
    } finally {
      setBusy("");
    }
  };

  const importSession = async (file: File) => {
    setBusy("import");
    setMsg("");
    try {
      const text = await file.text();
      const state = JSON.parse(text);
      const s = await api.importSession(state);
      setSettings(s);
      setMsg(
        s.loggedIn
          ? "세션을 가져왔고 유효성도 확인했습니다."
          : "세션을 저장했지만 유효성 확인에 실패했습니다. 블로그 이름/세션 만료를 확인하세요.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "가져오기 실패");
    } finally {
      setBusy("");
    }
  };

  if (!settings) return <p className="text-slate-400">불러오는 중...</p>;

  return (
    <div className="max-w-xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">티스토리 설정</h2>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">
            블로그 이름
          </span>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-slate-700 bg-slate-900 px-3">
              <input
                value={blogName}
                onChange={(e) => setBlogName(e.target.value)}
                placeholder="myblog"
                className="flex-1 bg-transparent py-2 outline-none"
              />
              <span className="text-sm text-slate-500">.tistory.com</span>
            </div>
            <button
              disabled={busy === "save" || !blogName.trim()}
              onClick={saveBlogName}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">로그인 상태</h3>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
              settings.loggedIn
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-red-500/20 text-red-300"
            }`}
          >
            {settings.loggedIn ? "로그인됨" : "로그아웃 상태"}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          마지막 확인: {formatDateTime(settings.lastLoginCheckAt)}
        </p>
        <p className="text-sm text-slate-400">
          "로그인" 을 누르면 브라우저 창이 열립니다. 직접 티스토리(카카오)
          로그인을 완료하면 세션이 저장되어 예약 발행에 사용됩니다.
        </p>
        <div className="flex gap-2">
          <button
            disabled={busy === "login" || !settings.blogName}
            onClick={login}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy === "login" ? "로그인 대기 중..." : "로그인"}
          </button>
          <button
            disabled={busy === "check" || !settings.blogName}
            onClick={check}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            세션 확인
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h3 className="font-medium">세션 이전 (클라우드 배포용)</h3>
        <p className="text-sm text-slate-400">
          클라우드(원격) 서버는 로그인 창을 직접 띄울 수 없습니다. <b>내 PC에서 로그인</b>한 뒤
          세션을 <b>내보내기</b> 하고, 클라우드에 올린 대시보드의 설정에서 <b>가져오기</b> 하면
          원격 서버도 로그인 상태로 발행할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy === "export"}
            onClick={exportSession}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "export" ? "내보내는 중..." : "세션 내보내기 (다운로드)"}
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
            {busy === "import" ? "가져오는 중..." : "세션 가져오기 (업로드)"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={busy === "import"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importSession(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      {msg && (
        <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
          {msg}
        </p>
      )}
    </div>
  );
}
