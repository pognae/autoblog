import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** server 패키지 루트 (src 또는 dist 기준 한 단계 위) */
const SERVER_ROOT = path.resolve(__dirname, "..");

/**
 * 비밀이 아닌 서버 설정 기본값. git/배포에 함께 포함되는 커밋 파일.
 * (포트·스케줄러·헤드리스·모델명·baseUrl 등 — 시크릿이 아님)
 * 우선순위: 환경변수 > server/config.json > 코드 기본값.
 */
interface FileConfig {
  port?: number;
  webOrigin?: string;
  scheduler?: { cron?: string; autoStart?: boolean };
  playwright?: { headless?: boolean };
  openai?: { model?: string; baseUrl?: string };
  gemini?: { model?: string };
}

function loadFileConfig(): FileConfig {
  try {
    const p = path.join(SERVER_ROOT, "config.json");
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8")) as FileConfig;
    }
  } catch (err) {
    console.warn(
      "[config] config.json 읽기 실패 (코드 기본값 사용):",
      err instanceof Error ? err.message : err,
    );
  }
  return {};
}

const file = loadFileConfig();

/** env 가 명시돼 있으면 그것을, 아니면 파일/기본값을 쓴다. */
function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "true";
}

export const config = {
  port: Number(process.env.PORT ?? file.port ?? 4000),
  /** 프론트엔드 개발 서버 주소 (CORS 허용용) */
  webOrigin: process.env.WEB_ORIGIN ?? file.webOrigin ?? "http://localhost:5173",

  paths: {
    /** 데이터 디렉터리 (DB, 업로드된 md) */
    data: path.join(SERVER_ROOT, "data"),
    /** lowdb json 파일 (글/키워드/사용량 등 운영 데이터) */
    db: path.join(SERVER_ROOT, "data", "db.json"),
    /**
     * 화면에서 입력한 "설정"만 따로 보관하는 파일.
     * (블로그 이름 + 자동발행 설정 + 텔레그램 설정)
     * 프로그램이 수정/재배포되어도 이 파일을 읽어 설정을 복원한다.
     * APP_CONFIG_FILE 로 경로를 바꿀 수 있다(영속 볼륨 경로 지정용).
     */
    appConfig:
      process.env.APP_CONFIG_FILE ??
      path.join(SERVER_ROOT, "data", "app-config.json"),
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
    /** 빌드된 프론트엔드(web/dist). 프로덕션에서 서버가 같이 서빙한다. */
    webDist: path.resolve(SERVER_ROOT, "..", "web", "dist"),
  },

  scheduler: {
    /** 예약 글 확인 주기 (cron). 기본: 매 분 */
    cron: process.env.SCHEDULER_CRON ?? file.scheduler?.cron ?? "* * * * *",
    /** 시작 시 자동으로 스케줄러를 켤지 여부 */
    autoStart:
      process.env.SCHEDULER_AUTOSTART !== undefined
        ? process.env.SCHEDULER_AUTOSTART !== "false"
        : (file.scheduler?.autoStart ?? true),
  },

  openai: {
    /** API 키는 민감정보 → .env 전용 */
    apiKey: process.env.OPENAI_API_KEY ?? "",
    /** 기본 모델 (비밀 아님 → config.json) */
    model: process.env.OPENAI_MODEL ?? file.openai?.model ?? "gpt-4o-mini",
    /**
     * OpenAI 호환 base URL (비밀 아님 → config.json). openai-oauth 프록시를 쓰려면
     * http://127.0.0.1:10531/v1 처럼 지정. 비우면 공식 API 사용.
     */
    baseUrl: process.env.OPENAI_BASE_URL ?? file.openai?.baseUrl ?? "",
  },

  gemini: {
    /** API 키는 민감정보 → .env 전용 */
    apiKey: process.env.GEMINI_API_KEY ?? "",
    /** 기본 모델 (비밀 아님 → config.json) */
    model: process.env.GEMINI_MODEL ?? file.gemini?.model ?? "gemini-2.5-flash",
  },

  telegram: {
    /** 텔레그램 봇 토큰 (@BotFather 발급). 민감정보 → .env 전용. 비우면 알림 비활성화. */
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    /** 알림을 받을 채팅 ID (개인/그룹). 민감정보 → .env 전용. */
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
  },

  playwright: {
    /**
     * true 면 브라우저 창을 띄우지 않는 headless 모드.
     * 단, 티스토리/카카오는 headless 브라우저를 봇으로 감지해 로그인 세션이
     * 유효해도 로그인 페이지로 강제 리다이렉트하는 경우가 많다.
     * 그래서 기본값은 headful(창 표시, false) 이며, PW_HEADLESS=true 일 때만 headless 로 동작한다.
     */
    headless: envBool("PW_HEADLESS", file.playwright?.headless ?? false),
  },
} as const;
