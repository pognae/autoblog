import { useEffect, useState } from "react";
import {
  api,
  type MonitorStatus,
  type Settings,
  type TelegramChannel,
} from "../api.ts";
import { formatDateTime } from "../lib.ts";

type ChannelKey = "heartbeat" | "loginAlert" | "failureAlert";

const CHANNEL_LABELS: Record<ChannelKey, { title: string; desc: string }> = {
  heartbeat: { title: "정기 상태 보고", desc: "서버/로그인/글 통계 요약" },
  loginAlert: { title: "로그인 만료 경고", desc: "세션이 풀리면 경고" },
  failureAlert: { title: "발행 실패 알림", desc: "실패 글이 있으면 알림 + 재발행" },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blogName, setBlogName] = useState("");
  const [monitor, setMonitor] = useState<MonitorStatus | null>(null);
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [channels, setChannels] = useState<Record<ChannelKey, TelegramChannel>>(
    {
      heartbeat: { enabled: true, intervalMinutes: 360 },
      loginAlert: { enabled: true, intervalMinutes: 60 },
      failureAlert: { enabled: true, intervalMinutes: 60 },
    },
  );
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const load = () =>
    api.getSettings().then((s) => {
      setSettings(s);
      setBlogName(s.blogName);
    });

  const loadMonitor = () =>
    api.getMonitor().then((m) => {
      setMonitor(m);
      setTgChatId(m.chatId);
      setChannels({
        heartbeat: m.heartbeat,
        loginAlert: m.loginAlert,
        failureAlert: m.failureAlert,
      });
    });

  useEffect(() => {
    load();
    loadMonitor().catch(() => {});
  }, []);

  const patchChannel = (key: ChannelKey, p: Partial<TelegramChannel>) =>
    setChannels((c) => ({ ...c, [key]: { ...c[key], ...p } }));

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

  const saveTelegram = async () => {
    setBusy("tgSave");
    setMsg("");
    try {
      const m = await api.updateMonitor({
        botToken: tgToken || undefined, // 비우면 기존 토큰 유지
        chatId: tgChatId.trim(),
        heartbeat: channels.heartbeat,
        loginAlert: channels.loginAlert,
        failureAlert: channels.failureAlert,
      });
      setMonitor(m);
      setTgChatId(m.chatId);
      setChannels({
        heartbeat: m.heartbeat,
        loginAlert: m.loginAlert,
        failureAlert: m.failureAlert,
      });
      setTgToken("");
      setMsg("텔레그램 설정을 저장했습니다.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy("");
    }
  };

  const testTelegram = async () => {
    setBusy("telegram");
    setMsg("");
    try {
      const r = await api.testMonitor();
      setMsg(
        r.ok
          ? "텔레그램으로 테스트 알림을 보냈습니다. 메시지를 확인하세요."
          : "전송에 실패했습니다. 토큰/채팅 ID 를 확인하세요.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "전송 실패");
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

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">텔레그램 상태 알림</h3>
          {monitor && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                monitor.configured
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-600/40 text-slate-300"
              }`}
            >
              {monitor.configured ? "설정됨" : "미설정"}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          일정 주기마다 <b>로그인 여부·서버 상태·글 통계</b>를 점검해 텔레그램으로 알립니다.
          아래에 직접 입력해 저장하세요. (<b>@BotFather</b> 로 봇 생성 → 토큰, 봇과 대화 시작 후
          <code> getUpdates </code>로 채팅 ID 확인)
          {monitor?.fromEnv && (
            <span className="mt-1 block text-amber-400">
              ※ 현재 환경변수(.env)로 설정돼 있습니다. 아래에 입력해 저장하면 입력값이 우선합니다.
            </span>
          )}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">
            봇 토큰 {monitor?.hasToken ? "(설정됨)" : "(미설정)"}
          </span>
          <input
            type="password"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            placeholder={monitor?.hasToken ? "변경 시에만 입력 (지우려면 - 입력)" : "123456:ABC-..."}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-300">
            채팅 ID
          </span>
          <input
            value={tgChatId}
            onChange={(e) => setTgChatId(e.target.value)}
            placeholder="123456789"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-indigo-500"
          />
        </label>

        {/* 알림 종류별 on/off 스위치 + 개별 주기 */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-300">
            알림 종류별 설정
          </span>
          {(["heartbeat", "loginAlert", "failureAlert"] as ChannelKey[]).map(
            (key) => {
              const ch = channels[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {CHANNEL_LABELS[key].title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {CHANNEL_LABELS[key].desc}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      주기
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={ch.intervalMinutes}
                        disabled={!ch.enabled}
                        onChange={(e) =>
                          patchChannel(key, {
                            intervalMinutes: Number(e.target.value),
                          })
                        }
                        className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right outline-none focus:border-indigo-500 disabled:opacity-40"
                      />
                      분
                    </label>
                    <Toggle
                      checked={ch.enabled}
                      onChange={(v) => patchChannel(key, { enabled: v })}
                    />
                  </div>
                </div>
              );
            },
          )}
        </div>

        <div className="flex gap-2">
          <button
            disabled={busy === "tgSave"}
            onClick={saveTelegram}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy === "tgSave" ? "저장 중..." : "텔레그램 설정 저장"}
          </button>
          <button
            disabled={busy === "telegram" || !monitor?.configured}
            onClick={testTelegram}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "telegram" ? "전송 중..." : "테스트 알림 보내기"}
          </button>
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
