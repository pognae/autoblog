import fs from "node:fs";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { config } from "./config.js";

/**
 * 티스토리 자동화 모듈.
 *
 * 티스토리 Open API 는 2024년에 종료되어, 현재 자동 포스팅은 브라우저 자동화가
 * 유일하게 현실적인 방법입니다. 사용자가 한 번 직접 로그인하면 그 세션을
 * storageState(JSON) 로 저장하고, 이후 예약/즉시 발행 시 복원해 재사용합니다.
 *
 * ⚠️ 왜 launchPersistentContext 가 아니라 storageState 인가?
 * 티스토리/카카오 로그인 쿠키 중 일부는 만료시간이 없는 "세션 쿠키"라서,
 * 영속 컨텍스트의 디스크 프로필에는 저장되지 않습니다. 그래서 로그인 직후엔
 * 멀쩡하다가 브라우저를 새로 열면 로그인이 풀려 "세션 만료"가 발생합니다.
 * storageState 는 세션 쿠키까지 스냅샷으로 보존하므로 이 문제를 해결합니다.
 *
 * ⚠️ 주의: 티스토리 에디터의 DOM 구조는 공식 문서가 없고 수시로 바뀝니다.
 * 셀렉터가 동작하지 않으면 아래 SELECTORS 상수만 수정하면 됩니다.
 * 실패 시 server/screenshots 에 스크린샷이 남습니다.
 */

const SELECTORS = {
  // 글쓰기(이어쓰기) 확인 모달의 "새 글 작성하기" / 취소 버튼
  continueModalCancel:
    'button:has-text("취소"), button:has-text("아니오"), .btn_close',
  // 제목 입력
  titleInput: '#post-title-inp, textarea[name="title"], input[name="title"]',
  // 에디터 모드 전환 버튼 (기본/마크다운/HTML)
  modeButton: '#editor-mode-layer-btn-open, button:has-text("기본모드")',
  modeMarkdown: '#editor-mode-markdown, a:has-text("마크다운")',
  modeMarkdownConfirm: 'button:has-text("확인")',
  // 마크다운 에디터 (CodeMirror)
  markdownEditor: ".CodeMirror, .cm-content, textarea#markdown-source",
  // 태그 입력
  tagInput: '#tagText, input[name="tag"], input[placeholder*="태그"]',
  // 발행 레이어 열기
  publishLayerOpen: '#publish-layer-btn, button:has-text("발행")',
  // 공개/비공개 라디오
  visibilityPublic: '#open20, input[value="20"]',
  visibilityProtected: '#open15, input[value="15"]',
  visibilityPrivate: '#open0, input[value="0"]',
  // 최종 발행 버튼
  publishConfirm: '#publish-btn, button:has-text("공개 발행"), button:has-text("발행")',
} as const;

export interface PublishInput {
  blogName: string;
  title: string;
  /** 마크다운 원본 */
  markdown: string;
  /** 마크다운을 변환한 HTML (에디터에 실제로 주입할 본문) */
  html: string;
  tags: string[];
  categoryId?: string;
  visibility: "public" | "protected" | "private";
}

export interface PublishResult {
  url?: string;
}

function manageUrl(blogName: string): string {
  return `https://${blogName}.tistory.com/manage/newpost/`;
}

/** 저장된 로그인 세션(state.json)이 존재하는지 */
function hasSavedSession(): boolean {
  return fs.existsSync(config.paths.state);
}

async function launchBrowser(headless: boolean): Promise<Browser> {
  return chromium.launch({
    headless,
    // 자동화 탐지(봇 차단)를 줄이기 위한 옵션.
    // "Chrome 자동 제어 중" 배너/플래그 제거 + webdriver 흔적 완화.
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

/** 저장된 세션(storageState)을 복원한 새 컨텍스트를 만든다. */
async function newContextWithSession(
  browser: Browser,
): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "ko-KR",
    storageState: hasSavedSession() ? config.paths.state : undefined,
  });
}

/** 현재 컨텍스트의 모든 쿠키(세션 쿠키 포함)를 스냅샷으로 저장 */
async function saveSession(ctx: BrowserContext): Promise<void> {
  await ctx.storageState({ path: config.paths.state });
}

async function screenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({
      path: path.join(config.paths.screenshots, `${name}-${Date.now()}.png`),
      fullPage: true,
    });
  } catch {
    /* 스크린샷 실패는 무시 */
  }
}

/**
 * 헤드풀 브라우저를 띄워 사용자가 직접 로그인하도록 한다.
 * 로그인이 감지되거나 타임아웃(기본 5분)될 때까지 대기한다.
 */
export async function loginInteractive(
  blogName: string,
  onStatus?: (msg: string) => void,
): Promise<{ success: boolean }> {
  const browser = await launchBrowser(false);
  const ctx = await newContextWithSession(browser);
  const page = await ctx.newPage();
  try {
    onStatus?.("로그인 페이지를 여는 중...");
    await page.goto("https://www.tistory.com/auth/login", {
      waitUntil: "domcontentloaded",
    });

    const deadline = Date.now() + 5 * 60 * 1000; // 5분
    onStatus?.("브라우저에서 직접 로그인해 주세요. (최대 5분 대기)");

    // 새 창을 띄우지 않고, 컨텍스트 쿠키를 공유하는 HTTP 요청으로만 로그인 여부 확인
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      const ok = await isLoggedIn(ctx, blogName);
      if (ok) {
        // 세션 쿠키까지 포함해 스냅샷으로 저장 (핵심)
        await saveSession(ctx);
        onStatus?.("로그인 확인됨. 세션을 저장했습니다.");
        return { success: true };
      }
    }
    onStatus?.("로그인 대기 시간이 초과되었습니다.");
    return { success: false };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

/**
 * 현재 저장된 세션으로 관리자 페이지 접근이 가능한지(=로그인 상태) 확인한다.
 *
 * 새 탭/창을 열지 않고 `ctx.request` 로 HTTP 요청만 보낸다.
 * - 브라우저 컨텍스트와 쿠키를 공유하므로 로그인 세션이 그대로 적용된다.
 * - 화면을 띄우지 않아 깜빡이는 창이 생기지 않고, 헤드리스 봇 감지 리다이렉트도 회피된다.
 */
async function isLoggedIn(
  ctx: BrowserContext,
  blogName: string,
): Promise<boolean> {
  const checkUrl = blogName
    ? `https://${blogName}.tistory.com/manage`
    : "https://www.tistory.com/manage";
  try {
    // 리다이렉트를 끝까지 따라간 뒤 "최종 URL" 로 판정한다.
    // (maxRedirects:0 은 Playwright 버전에 따라 예외를 던질 수 있어 쓰지 않는다.)
    const resp = await ctx.request.get(checkUrl, { timeout: 20000 });
    const finalUrl = resp.url();
    const loggedIn =
      resp.ok() && !/auth\/login|accounts\.kakao|\/login/i.test(finalUrl);
    console.log(
      `[tistory] 세션확인 status=${resp.status()} final=${finalUrl} -> ${
        loggedIn ? "로그인" : "로그아웃"
      }`,
    );
    return loggedIn;
  } catch (err) {
    console.log(
      "[tistory] 세션확인 오류:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/** 저장된 세션만으로 로그인 상태를 점검 (HTTP 요청 기반, 창 안 띄움) */
export async function checkSession(blogName: string): Promise<boolean> {
  if (!hasSavedSession()) return false;
  const browser = await launchBrowser(true);
  try {
    const ctx = await newContextWithSession(browser);
    const ok = await isLoggedIn(ctx, blogName);
    if (ok) await saveSession(ctx); // 유효하면 최신 쿠키로 갱신
    await ctx.close();
    return ok;
  } finally {
    await browser.close();
  }
}

/** 예약된 글을 실제로 발행한다. */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  if (!hasSavedSession()) {
    throw new Error("로그인이 필요합니다. 설정에서 먼저 로그인해 주세요.");
  }

  console.log(
    `[publish] 시작: "${input.title}" (headless=${config.playwright.headless})`,
  );
  const browser = await launchBrowser(config.playwright.headless);
  const ctx = await newContextWithSession(browser);
  const page = await ctx.newPage();

  // 네이티브 다이얼로그 처리:
  // - beforeunload(페이지 이탈)는 수락해 진행을 막지 않는다.
  // - "이어서 작성하시겠습니까?" 같은 confirm 은 거절(취소)해 항상 새 글로 시작한다.
  page.on("dialog", (d) => {
    if (d.type() === "beforeunload") d.accept().catch(() => {});
    else d.dismiss().catch(() => {});
  });

  try {
    // 1) 페이지를 열기 전에 쿠키 기반(HTTP)으로 세션 유효성을 먼저 확인한다.
    //    여기서 실패하면 진짜로 로그아웃 상태이다.
    const sessionOk = await isLoggedIn(ctx, input.blogName);
    if (!sessionOk) {
      throw new Error(
        "로그인 세션이 만료되었습니다. 설정에서 다시 로그인해 주세요.",
      );
    }

    console.log("[publish] 글쓰기 페이지로 이동...");
    await page.goto(manageUrl(input.blogName), {
      waitUntil: "domcontentloaded",
    });

    // 2) 세션은 유효(위에서 통과)한데도 로그인 페이지로 튕긴다면,
    //    이는 세션 만료가 아니라 헤드리스 브라우저 봇 차단일 가능성이 높다.
    if (/auth\/login|accounts\.kakao/.test(page.url())) {
      throw new Error(
        "로그인 페이지로 리다이렉트되었습니다. 브라우저 자동화가 차단된 것으로 보입니다. " +
          "server/.env 에서 PW_HEADLESS=false (브라우저 창 표시)로 설정한 뒤 다시 시도해 주세요.",
      );
    }

    // "이어서 작성하시겠습니까?" 모달이 뜨면 새 글로 시작
    await dismissContinueModal(page);

    // 제목 입력
    console.log("[publish] 제목 입력...");
    await page.waitForSelector(SELECTORS.titleInput, { timeout: 15000 });
    await page.fill(SELECTORS.titleInput, input.title);

    // 본문 입력: 현재 활성 에디터를 자동 감지해 HTML 을 직접 주입
    console.log("[publish] 본문 입력...");
    await fillEditorContent(page, input.html);

    // 태그
    if (input.tags.length > 0) {
      await fillTags(page, input.tags);
    }

    // 발행
    console.log("[publish] 발행 진행...");
    const url = await publish(page, input.visibility);

    // 발행 성공 후 최신 쿠키로 세션 갱신
    await saveSession(ctx);
    console.log(`[publish] 완료: ${url ?? "(URL 미확인)"}`);
    return { url };
  } catch (err) {
    await screenshot(page, "publish-error");
    throw err;
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function dismissContinueModal(page: Page): Promise<void> {
  try {
    const cancel = page.locator(SELECTORS.continueModalCancel).first();
    await cancel.waitFor({ state: "visible", timeout: 3000 });
    await cancel.click();
  } catch {
    // 모달이 없으면 정상
  }
}

/**
 * 본문을 입력한다.
 *
 * 티스토리 에디터는 3종류가 혼재하므로 모드 전환에 의존하지 않고,
 * 현재 화면에 떠 있는 에디터를 자동 감지해 변환된 HTML 을 직접 주입한다.
 *   1) 기본모드: TinyMCE iframe(#editor-tistory_ifr) 의 body.innerHTML
 *   2) HTML/마크다운 모드: CodeMirror 인스턴스의 setValue()
 *   3) ProseMirror contenteditable: innerHTML
 *   4) 일반 textarea#content
 */
async function fillEditorContent(page: Page, html: string): Promise<void> {
  // 1) TinyMCE (기본모드): 내부 API 로 setContent 후 textarea 로 동기화(save)
  //    DOM(body.innerHTML)을 직접 바꾸면 내부 모델과 동기화되지 않아 발행 시
  //    본문이 비어버린다. 반드시 에디터 인스턴스의 setContent/save 를 써야 한다.
  const tinymceDone = await page.evaluate((content) => {
    const w = window as any;
    const tm = w.tinymce || w.tinyMCE;
    if (!tm) return false;
    const ed =
      tm.activeEditor ??
      (tm.get && (tm.get("editor-tistory") || (tm.editors && tm.editors[0])));
    if (!ed) return false;
    ed.setContent(content);
    if (ed.fire) ed.fire("change");
    if (ed.save) ed.save(); // 내부 <textarea> 로 동기화 (발행 시 이 값이 저장됨)
    return true;
  }, html);
  if (tinymceDone) {
    console.log("[publish] 본문 입력 방식: TinyMCE API");
    return;
  }

  // 2) CodeMirror (HTML/마크다운 모드)
  const cmDone = await page.evaluate((content) => {
    const els = Array.from(
      document.querySelectorAll(".CodeMirror"),
    ) as unknown as Array<HTMLElement & { CodeMirror?: any }>;
    const target =
      els.find((el) => el.offsetParent !== null && el.CodeMirror) ??
      els.find((el) => el.CodeMirror);
    if (target?.CodeMirror) {
      target.CodeMirror.setValue(content);
      target.CodeMirror.save?.(); // 내부 textarea 로 동기화
      setTimeout(() => target.CodeMirror.refresh?.(), 10);
      return true;
    }
    return false;
  }, html);
  if (cmDone) {
    console.log("[publish] 본문 입력 방식: CodeMirror");
    return;
  }

  // 3) ProseMirror contenteditable
  const pmDone = await page.evaluate((content) => {
    const el = document.querySelector(".ProseMirror") as HTMLElement | null;
    if (el) {
      el.innerHTML = content;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }, html);
  if (pmDone) {
    console.log("[publish] 본문 입력 방식: ProseMirror");
    return;
  }

  // 4) 일반 textarea
  const textarea = await page.$("textarea#content");
  if (textarea) {
    await textarea.fill(html);
    console.log("[publish] 본문 입력 방식: textarea");
    return;
  }

  throw new Error(
    "본문 에디터를 찾지 못했습니다. 티스토리 에디터 구조가 변경되었을 수 있습니다.",
  );
}

async function fillTags(page: Page, tags: string[]): Promise<void> {
  try {
    const tagInput = page.locator(SELECTORS.tagInput).first();
    await tagInput.waitFor({ state: "visible", timeout: 5000 });
    for (const tag of tags) {
      await tagInput.click();
      await tagInput.type(tag);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
    }
  } catch {
    // 태그 입력 실패는 치명적이지 않으므로 통과
  }
}

async function publish(
  page: Page,
  visibility: PublishInput["visibility"],
): Promise<string | undefined> {
  await page.click(SELECTORS.publishLayerOpen, { timeout: 10000 });
  await page.waitForTimeout(500);

  const visSelector =
    visibility === "public"
      ? SELECTORS.visibilityPublic
      : visibility === "protected"
        ? SELECTORS.visibilityProtected
        : SELECTORS.visibilityPrivate;
  try {
    await page.click(visSelector, { timeout: 3000 });
  } catch {
    /* 공개범위 선택 실패 시 기본값 사용 */
  }

  await page.click(SELECTORS.publishConfirm, { timeout: 10000 });

  // 발행 후 글 페이지로 이동하길 기다린다
  try {
    await page.waitForURL(/tistory\.com\/\d+/, { timeout: 15000 });
    return page.url();
  } catch {
    await page.waitForTimeout(2000);
    return page.url();
  }
}
