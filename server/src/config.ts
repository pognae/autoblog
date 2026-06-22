import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** server 패키지 루트 (src 또는 dist 기준 한 단계 위) */
const SERVER_ROOT = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT ?? 4000),
  /** 프론트엔드 개발 서버 주소 (CORS 허용용) */
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",

  paths: {
    /** 데이터 디렉터리 (DB, 업로드된 md) */
    data: path.join(SERVER_ROOT, "data"),
    /** lowdb json 파일 */
    db: path.join(SERVER_ROOT, "data", "db.json"),
    /** 업로드/작성된 마크다운 원본 저장 위치 */
    posts: path.join(SERVER_ROOT, "data", "posts"),
    /** 발행 시 첨부 이미지 임시 위치 */
    uploads: path.join(SERVER_ROOT, "data", "uploads"),
    /** Playwright 세션 디렉터리 */
    session: path.join(SERVER_ROOT, ".session"),
    /** 로그인 세션 스냅샷(storageState) JSON. 세션 쿠키까지 보존 */
    state: path.join(SERVER_ROOT, ".session", "state.json"),
    /** 실패 시 디버깅용 스크린샷 */
    screenshots: path.join(SERVER_ROOT, "screenshots"),
  },

  scheduler: {
    /** 예약 글 확인 주기 (cron). 기본: 매 분 */
    cron: process.env.SCHEDULER_CRON ?? "* * * * *",
    /** 시작 시 자동으로 스케줄러를 켤지 여부 */
    autoStart: process.env.SCHEDULER_AUTOSTART !== "false",
  },

  openai: {
    /** 환경변수로 넣은 API 키 (UI 설정값이 우선) */
    apiKey: process.env.OPENAI_API_KEY ?? "",
    /** 기본 모델 */
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    /**
     * OpenAI 호환 base URL. openai-oauth 프록시를 쓰려면
     * http://127.0.0.1:10531/v1 처럼 지정. 비우면 공식 API 사용.
     */
    baseUrl: process.env.OPENAI_BASE_URL ?? "",
  },

  gemini: {
    /** 환경변수로 넣은 Gemini API 키 (UI 설정값이 우선) */
    apiKey: process.env.GEMINI_API_KEY ?? "",
    /** 기본 모델 */
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },

  playwright: {
    /**
     * true 면 브라우저 창을 띄우지 않는 headless 모드.
     * 단, 티스토리/카카오는 headless 브라우저를 봇으로 감지해 로그인 세션이
     * 유효해도 로그인 페이지로 강제 리다이렉트하는 경우가 많다.
     * 그래서 기본값은 headful(창 표시, false) 이며, PW_HEADLESS=true 일 때만 headless 로 동작한다.
     */
    headless: process.env.PW_HEADLESS === "true",
  },
} as const;
