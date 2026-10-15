/**
 * 일회성 실행용 엔트리: 오토파일럿 하루치를 실행하고 종료한다.
 * GitHub Actions의 daily-publish 워크플로우에서 사용.
 * - 웹서버/스케줄러를 띄우지 않음
 * - DB(server/data/db.json)와 로그인 세션(server/.session/state.json)은 사전에 준비되어야 함
 */
import { initDb } from "./db.js";
import { initPersistedConfig } from "./config.store.js";
import { runNow } from "./autopilot.js";

async function main(): Promise<void> {
  await initDb();
  await initPersistedConfig();
  const summary = await runNow();
  console.log(`[run-once] 완료: ${summary}`);
}

main().catch((err) => {
  console.error(
    "[run-once] 실패:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
