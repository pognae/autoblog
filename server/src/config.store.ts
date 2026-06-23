import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { db } from "./db.js";
import type { AutopilotConfig, TelegramConfig } from "./types.js";

/**
 * 화면에서 입력한 "설정"을 전용 파일(app-config.json)에 영속화한다.
 *
 * 왜 db.json 과 분리하나?
 * - db.json 은 글/키워드/사용량 등 운영 데이터까지 섞여 있어, 프로그램 수정/재배포 시
 *   설정만 안전하게 복원하기 어렵다.
 * - 설정(블로그 이름 + 자동발행 설정 + 텔레그램 설정)만 별도 파일로 보관하면,
 *   클라우드 재배포(컨테이너 초기화) 후에도 이 파일만 읽어 그대로 복원할 수 있다.
 *   (이 파일을 영속 볼륨에 두거나 APP_CONFIG_FILE 로 볼륨 경로를 지정하면 유지됨)
 */

interface PersistedConfig {
  version: number;
  blogName: string;
  autopilot: AutopilotConfig;
  telegram: TelegramConfig;
  savedAt: string;
}

/** 파일을 읽어 파싱한다. 없거나 깨졌으면 null. */
function readConfigFile(): Partial<PersistedConfig> | null {
  try {
    if (!fs.existsSync(config.paths.appConfig)) return null;
    const raw = fs.readFileSync(config.paths.appConfig, "utf-8");
    return JSON.parse(raw) as Partial<PersistedConfig>;
  } catch (err) {
    console.warn(
      "[config] app-config.json 읽기 실패 (무시):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** 현재 DB 의 설정을 파일로 저장한다. (원자적 쓰기: temp → rename) */
export function savePersistedConfig(): void {
  // 실행 상태(lastRunDate/lastRunResult/lastRunAt)는 "설정"이 아니라 운영 데이터이므로
  // 파일에 저장하지 않는다. (저장하면 재시작 시 오래된 실행일자가 복원돼 중복 실행 위험)
  const { lastRunDate, lastRunResult, lastRunAt, ...autopilotConfig } =
    db.data.autopilot;
  void lastRunDate;
  void lastRunResult;
  void lastRunAt;

  const data: PersistedConfig = {
    version: 1,
    blogName: db.data.settings.blogName,
    autopilot: autopilotConfig as AutopilotConfig,
    telegram: db.data.telegram,
    savedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(config.paths.appConfig), { recursive: true });
    const tmp = `${config.paths.appConfig}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, config.paths.appConfig);
  } catch (err) {
    console.warn(
      "[config] app-config.json 저장 실패:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * 서버 시작 시 호출.
 * - 설정 파일이 있으면 그 값을 DB 에 덮어써 복원한다(설정 파일이 우선).
 * - 없으면 현재 DB 설정으로 파일을 처음 생성한다.
 * initDb() 다음에 호출해야 한다.
 */
export async function initPersistedConfig(): Promise<void> {
  const f = readConfigFile();
  if (!f) {
    savePersistedConfig();
    console.log(
      `[config] 설정 파일 생성: ${config.paths.appConfig}`,
    );
    return;
  }

  if (typeof f.blogName === "string") {
    db.data.settings.blogName = f.blogName;
  }
  if (f.autopilot) {
    // 혹시 구버전 파일에 실행 상태가 들어 있어도 복원하지 않는다(중복 실행 방지).
    const {
      lastRunDate: _d,
      lastRunResult: _r,
      lastRunAt: _a,
      ...fileAutopilot
    } = f.autopilot;
    void _d;
    void _r;
    void _a;
    db.data.autopilot = {
      ...db.data.autopilot,
      ...fileAutopilot,
      openai: { ...db.data.autopilot.openai, ...(fileAutopilot.openai ?? {}) },
      gemini: { ...db.data.autopilot.gemini, ...(fileAutopilot.gemini ?? {}) },
    };
  }
  if (f.telegram) {
    db.data.telegram = { ...db.data.telegram, ...f.telegram };
  }
  await db.write();
  console.log(
    `[config] 설정 파일에서 복원함: ${config.paths.appConfig}`,
  );
}
