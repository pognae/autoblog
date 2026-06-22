import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api.ts";
import PostsPage from "./pages/PostsPage.tsx";
import EditorPage from "./pages/EditorPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import AutopilotPage from "./pages/AutopilotPage.tsx";

function SchedulerBadge() {
  const [running, setRunning] = useState<boolean | null>(null);

  const refresh = () =>
    api.getScheduler().then((s) => setRunning(s.running)).catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const toggle = async () => {
    if (running) await api.stopScheduler();
    else await api.startScheduler();
    refresh();
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          running ? "bg-emerald-400" : "bg-slate-500"
        }`}
      />
      스케줄러 {running ? "ON" : "OFF"}
    </button>
  );
}

export default function App() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-indigo-400">Auto</span>Blog
            </span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                글 목록
              </NavLink>
              <NavLink to="/new" className={linkClass}>
                새 글
              </NavLink>
              <NavLink to="/autopilot" className={linkClass}>
                자동 발행
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                설정
              </NavLink>
            </nav>
          </div>
          <SchedulerBadge />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<PostsPage />} />
          <Route path="/new" element={<EditorPage />} />
          <Route path="/edit/:id" element={<EditorPage />} />
          <Route path="/autopilot" element={<AutopilotPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
