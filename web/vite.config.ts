import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // localhost 는 Windows 에서 IPv6(::1) 로 먼저 풀려 백엔드와 어긋날 수 있어 IPv4 고정
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        configure: (proxy) => {
          // 백엔드(tsx watch)가 아직 부팅 중이면 잠깐 ECONNREFUSED 가 난다.
          // 스택 트레이스를 쏟아내지 말고, 프론트가 재시도하도록 503 만 돌려준다.
          proxy.on("error", (err, _req, res) => {
            const warming = (err as NodeJS.ErrnoException).code === "ECONNREFUSED";
            if (warming) {
              console.warn("[proxy] 백엔드(4000) 준비 중… 잠시 후 자동 재시도됩니다.");
            } else {
              console.warn(`[proxy] 오류: ${err.message}`);
            }
            const r = res as import("node:http").ServerResponse;
            if ("writeHead" in r && !r.headersSent) {
              r.writeHead(503, { "Content-Type": "application/json" });
            }
            if ("end" in r) {
              r.end(JSON.stringify({ error: "백엔드 준비 중" }));
            }
          });
        },
      },
    },
  },
});
