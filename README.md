# AutoBlog — 티스토리 예약 자동 발행

미리 작성한 **Markdown(.md) 파일을 정해진 시간에 티스토리에 자동으로 발행**하는 프로그램입니다.
**Node.js(백엔드) + React(대시보드) + TypeScript** 모노레포로 구성되어 있습니다.

---

## 목차

1. [새 컴퓨터에서 처음부터 실행하기 (Quick Start)](#새-컴퓨터에서-처음부터-실행하기-quick-start)
2. [동작 방식 (중요)](#동작-방식-중요)
3. [작업한 내용 (구현 기능)](#작업한-내용-구현-기능)
4. [기술 스택](#기술-스택)
5. [폴더 구조](#폴더-구조)
6. [설치 방법 (상세)](#설치-방법-상세)
7. [실행 방법 (상세)](#실행-방법-상세)
8. [클라우드 배포 (cloudtype 등 24시간 자동 발행)](#클라우드-배포-cloudtype-등-24시간-자동-발행)
9. [텔레그램 상태 알림 설정](#텔레그램-상태-알림-설정)
10. [ChatGPT 계정 OAuth(openai-oauth)로 OpenAI 쓰기](#chatgpt-계정-oauthopenai-oauth로-openai-쓰기)
11. [사용법 (단계별)](#사용법-단계별)
12. [Markdown 작성 규칙](#markdown-작성-규칙)
13. [환경변수 설정](#환경변수-설정)
14. [REST API 명세](#rest-api-명세)
15. [데이터 저장 위치](#데이터-저장-위치)
16. [설정 영속화 (화면 입력 설정 파일 저장)](#설정-영속화-화면-입력-설정-파일-저장)
17. [문제 해결 (트러블슈팅)](#문제-해결-트러블슈팅)
18. [주의사항 / 한계](#주의사항--한계)
19. [작업 기록 (변경 이력)](#작업-기록-변경-이력)

---

## 새 컴퓨터에서 처음부터 실행하기 (Quick Start)

> 아무것도 설치되지 않은 **완전히 새 컴퓨터**에서 이 프로그램을 처음 실행할 때, 아래 순서를 위에서부터 그대로 따라 하면 됩니다. (Windows / macOS / Linux 공통, 명령은 동일)

### 0. 사전 준비물 설치 (최초 1회)

| 프로그램 | 버전 | 확인 명령 | 다운로드 |
| --- | --- | --- | --- |
| **Node.js** | 20 이상 (22 권장) | `node -v` | <https://nodejs.org> 의 LTS 버전 |
| **npm** | 9 이상 (Node 설치 시 같이 설치됨) | `npm -v` | (Node 포함) |
| **Git** | 최신 | `git --version` | <https://git-scm.com> |

> Node 설치 후 터미널(Windows는 PowerShell)을 **새로 연 다음** `node -v` 가 `v20` 이상으로 나오는지 먼저 확인하세요.

### 1. 소스 코드 내려받기

```bash
git clone <이-저장소-URL> autoblog
cd autoblog
```

> 이미 폴더(예: `d:\dev\autoblog`)가 있다면 이 단계는 건너뛰고 해당 폴더에서 터미널을 엽니다.

### 2. 의존성 설치 (서버 + 웹 + 브라우저 한 번에)

루트 폴더에서 **딱 한 번** 실행합니다.

```bash
npm install
```

이 한 줄이 다음을 모두 자동 수행합니다.
1. `server`, `web` 워크스페이스 의존성 설치
2. `postinstall` 훅으로 Playwright용 **Chromium 브라우저 자동 다운로드**(약 180MB)

> Chromium 다운로드가 실패하면 수동으로:
> ```bash
> npx playwright install chromium
> ```

### 3. 환경변수 파일 만들기

`server/.env.example` 를 복사해 `server/.env` 를 만듭니다. (기본값만으로도 바로 실행됩니다)

```bash
# Windows (PowerShell)
Copy-Item server/.env.example server/.env

# macOS / Linux
cp server/.env.example server/.env
```

> AI 자동 발행을 쓰려면 나중에 `server/.env` 에 `OPENAI_API_KEY` 또는 `GEMINI_API_KEY` 를 채우거나, UI(자동 발행 탭)에서 입력하면 됩니다. API 키 결제 없이 ChatGPT 계정으로 쓰려면 [openai-oauth 섹션](#chatgpt-계정-oauthopenai-oauth로-openai-쓰기)을 참고하세요.

### 4. 실행

```bash
npm run dev
```

- 백엔드: <http://localhost:4000>
- 대시보드: **<http://localhost:5173>** ← 브라우저로 이 주소 접속

### 5. 최초 로그인 (1회)

1. 대시보드 **설정** 탭 → **블로그 이름** 저장 (`myblog.tistory.com` 이면 `myblog`).
2. **로그인** 버튼 → 실제 브라우저 창이 열리면 **직접 티스토리(카카오) 로그인**.
3. "로그인됨" 으로 바뀌면 세션이 `server/.session/state.json` 에 저장됩니다.

이제 글을 작성·예약하거나, 자동 발행을 설정하면 됩니다. 자세한 단계는 [사용법](#사용법-단계별)을 참고하세요.

> ⚠️ 발행은 **브라우저 창을 띄우는 방식**이라, 발행 시각에 **PC가 켜져 있고 로그인 세션이 유효**해야 합니다.

---

## 동작 방식 (중요)

티스토리 **Open API 는 2024년 2월부로 완전히 종료**되어, 프로그래밍 방식의 글쓰기 API(글 작성·수정·이미지 첨부 등)가 더 이상 존재하지 않습니다. 신규 앱 등록과 기존 토큰 갱신도 모두 불가능합니다.

따라서 이 프로그램은 현실적으로 유일하게 가능한 **브라우저 자동화(Playwright)** 방식을 사용합니다.

```
[설정] 블로그 이름 입력 + 로그인 버튼
        │
        ▼
실제 브라우저 창이 열림 → 사용자가 직접 티스토리(카카오) 로그인
        │
        ▼
로그인 세션(쿠키)을 디스크에 영속 저장  (server/.session)
        │
        ▼
[스케줄러] 매 분 예약 글을 확인
        │
        ▼
예약 시각 도달 → 저장된 세션으로 브라우저 실행 → 글쓰기 페이지 자동 입력 → 발행
```

> **왜 자동 로그인이 아니라 수동 로그인인가?**
> 카카오 로그인은 캡차/2단계 인증이 자주 걸려 완전 무인 로그인이 불안정합니다.
> 그래서 "사용자가 한 번만 직접 로그인 → 세션을 영속화해 재사용"하는 방식을 택했습니다.

---

## 작업한 내용 (구현 기능)

### 백엔드 (`server/`)
- **글(Post) CRUD**: 마크다운 원본은 `data/posts/*.md` 파일로, 메타데이터는 lowdb(JSON DB)로 관리
- **마크다운 처리**: front-matter 파싱(`gray-matter`) + HTML 변환(`marked`, GFM 지원)
- **예약 발행 스케줄러**: `node-cron` 으로 매 분 예약 글을 확인하여 발행 시각이 지난 글을 순차 발행 (브라우저 동시 실행 방지를 위해 발행 작업 직렬화)
- **티스토리 자동화 (`tistory.ts`)**:
  - 영속 컨텍스트(persistent context) 기반 로그인 세션 유지
  - 헤드풀 브라우저로 대화형 로그인 (`loginInteractive`)
  - 저장된 세션 유효성 점검 (`checkSession`)
  - 글쓰기 페이지 자동 입력 및 발행 (`publishPost`) — 제목/마크다운 본문/태그/공개범위 설정
  - 실패 시 디버깅용 스크린샷 자동 저장
- **REST API**: 글, 설정, 스케줄러 제어 엔드포인트
- **파일 업로드**: `.md` 파일 다중 업로드로 글 일괄 생성 (`multer`)
- **입력 검증**: `zod` 스키마 기반
- **실패 글 자동 재발행 (`publisher.service.ts`)**: 발행에 실패(`failed`)했거나 서버가 도중에 멈춰 `publishing` 으로 남은 글을, **서버 재시작 / 재로그인 / 세션 가져오기 / 세션 확인 / 정기 점검** 시점에 오래된 순으로 순차 재발행. 세션 만료가 감지되면 즉시 중단(이후 글도 어차피 실패)하고 다음 로그인 때 재시도.
- **텔레그램 상태 알림 (`notifier.ts`)**: 알림을 **3종류**(정기 상태 보고 / 로그인 만료 경고 / 발행 실패 알림)로 나눠 **종류별 on/off 스위치 + 개별 주기(분)** 를 설정할 수 있습니다. 1분 단위 마스터 틱이 각 종류의 주기 도래 여부를 판정해 전송하며, 실패 글이 있으면 자동 재발행을 트리거합니다.

### 자동 발행 (AI 오토파일럿)
- AI(ChatGPT/Gemini)가 매달 수익형 키워드를 선정하고, 매일 지정 시각(기본 오전 10시)에 `postsPerDay`(기본 2개)만큼 글(제목·본문·태그)을 생성해 자동 발행
- **OpenAI ↔ Gemini 자동 전환(failover)**: 호출 실패(할당량 초과 등) 시 남은 다른 AI 로 자동 전환
- 제공자별 **누적 사용 토큰·사용 가능 여부** 표시 (잔액 API 부재로 사용량 기반)
- 월간 키워드 계획 저장/소진 시 자동 보충, 사용 키워드 추적
- 멀티 프로바이더 연동(`ai.ts`), 시각 기반 스케줄러(`autopilot.ts`), 설정/키워드/즉시실행/AI상태 REST API
- **실행 방식 2가지 구분**:
  - **AI 생성 후 1회 실행** (`/api/autopilot/run`): AI 로 새 글을 생성해 발행 (매일 스케줄과 동일 동작).
  - **지금 즉시 발행** (`/api/autopilot/run-existing`): **AI 호출 없이** 이미 만들어진 미발행 글(초안/예약/실패) 중 오래된 순으로 `postsPerDay` 개를 발행. AI 토큰을 아끼고 미리 만들어 둔 글을 빠르게 올릴 때 사용.
- **예약 시각 판정**: 정각 일치(`===`)가 아니라 "예약 시각 경과(`>=`) + 오늘 미실행" 으로 판정 → 그 시각에 서버가 꺼져 있었어도 켜진 뒤 그날 안에 1회 따라잡아(catch-up) 실행.

### 프론트엔드 (`web/`)
- **글 목록 페이지**: 상태 배지(초안/예약됨/발행 중/발행 완료/실패), 즉시 발행/편집/삭제, 8초마다 자동 갱신, 발행 URL·실패 사유 표시
- **에디터 페이지**: `.md` 파일 불러오기 또는 직접 작성, 제목/태그/공개범위/예약 시각 설정, 생성·수정 공용
- **설정 페이지**: 블로그 이름 저장, 로그인 실행, 세션 유효성 확인
- **스케줄러 인디케이터**: 상단에서 ON/OFF 토글 및 상태 표시
- 다크 테마 UI (Tailwind CSS v4)

### 검증 완료
- 서버 타입체크 통과 / 웹 프로덕션 빌드 통과 / 서버 빌드 통과
- 서버 부팅 후 `/api/health` → `{"ok":true}` 확인, 스케줄러 정상 시작 확인
- Playwright Chromium 설치 완료

---

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 언어 | TypeScript |
| 백엔드 | Node.js, Express, node-cron |
| 자동화 | Playwright (Chromium) |
| 데이터 | lowdb (JSON), 파일시스템(.md) |
| 마크다운 | marked, gray-matter |
| 검증 | zod |
| 프론트엔드 | React 18, React Router, Vite 6 |
| 스타일 | Tailwind CSS v4 |
| 모노레포 | npm workspaces |

---

## 폴더 구조

```
autoblog2/
├── package.json            # 루트(워크스페이스) 스크립트
├── README.md
├── server/                 # 백엔드
│   ├── .env.example        # 환경변수 예시
│   └── src/
│       ├── index.ts            # 서버 엔트리 (라우팅, 스케줄러/모니터 시작, web/dist 서빙, 시작 시 실패글 재발행)
│       ├── config.ts           # 설정/경로 정의
│       ├── config.store.ts     # 화면 입력 설정의 파일 영속화(app-config.json) 로드/저장
│       ├── types.ts            # 공용 타입 (Post, Settings, DB 스키마)
│       ├── db.ts               # lowdb 초기화/디렉터리 생성
│       ├── markdown.ts         # md 파싱 + HTML 변환
│       ├── posts.store.ts      # 글 CRUD (파일 + DB)
│       ├── scheduler.ts        # 예약 발행 스케줄러
│       ├── tistory.ts          # Playwright 자동화 (로그인/세션/발행)
│       ├── publisher.service.ts# 발행 오케스트레이션(직렬화)
│       ├── ai.ts               # AI(OpenAI/Gemini) 키워드/글 생성 + failover
│       ├── autopilot.ts        # 매일 자동 생성·발행 스케줄러 + 즉시발행(기존글)
│       ├── notifier.ts         # 텔레그램 상태 알림 + 정기 점검 모니터
│       └── routes/
│           ├── posts.ts        # /api/posts
│           ├── settings.ts     # /api/settings (+ 세션 내보내기/가져오기)
│           ├── scheduler.ts    # /api/scheduler
│           ├── autopilot.ts    # /api/autopilot (run / run-existing)
│           ├── ai.ts           # /api/ai (상태/사용량)
│           └── monitor.ts      # /api/monitor (텔레그램 상태/테스트)
└── web/                    # 프론트엔드
    ├── index.html
    ├── vite.config.ts      # /api -> localhost:4000 프록시
    └── src/
        ├── main.tsx
        ├── App.tsx             # 레이아웃/라우팅/스케줄러 배지
        ├── api.ts              # API 클라이언트 + 타입
        ├── lib.ts              # 상태 라벨/날짜 유틸
        ├── index.css
        └── pages/
            ├── PostsPage.tsx     # 글 목록
            ├── EditorPage.tsx    # 새 글/편집
            ├── AutopilotPage.tsx # 자동 발행(ChatGPT) 설정
            └── SettingsPage.tsx  # 설정/로그인
```

---

## 설치 방법 (상세)

### 사전 요구사항
- **Node.js 20 이상** (개발은 v22에서 검증), npm 9 이상
- **Git** (소스 내려받기용)
- 인터넷 연결 (Chromium 다운로드 및 AI 호출용)

### 설치

루트 디렉터리에서 한 번만 실행하면 됩니다.

```bash
npm install
```

이 명령은 다음을 자동으로 수행합니다.
1. 워크스페이스(server, web) 의존성 설치 (npm workspaces)
2. `postinstall` 훅으로 Playwright용 **Chromium 브라우저 자동 다운로드** (약 180MB)

> Chromium 자동 설치가 실패하면 수동으로 실행하세요.
> ```bash
> npx playwright install chromium
> ```

### 환경변수 파일

`server/.env.example` → `server/.env` 로 복사합니다. (없어도 기본값으로 동작하지만, 권장)
자세한 항목은 [환경변수 설정](#환경변수-설정)을 참고하세요.

---

## 실행 방법 (상세)

### 개발 모드 (백엔드 + 프론트 동시 실행) — 권장

```bash
npm run dev
```

- 백엔드: <http://localhost:4000>
- 대시보드: **<http://localhost:5173>** ← 브라우저로 접속

### 개별 실행

```bash
npm run dev:server   # 백엔드만 (tsx watch)
npm run dev:web      # 프론트만 (vite)
```

### 프로덕션 빌드 / 실행

```bash
npm run build        # server + web 빌드
npm start            # 백엔드 실행 (dist/index.js)
```

> 프로덕션에서 대시보드를 따로 서빙하려면 `web` 빌드 결과(`web/dist`)를 정적 호스팅하거나 `npm run dev:web` 으로 띄우세요.

### 전체 npm 스크립트 정리

| 명령 | 설명 |
| --- | --- |
| `npm install` | 의존성 설치 + Chromium 자동 다운로드 |
| `npm run dev` | 백엔드 + 프론트 동시 실행(개발) |
| `npm run dev:server` / `npm run dev:web` | 백엔드 / 프론트 개별 실행 |
| `npm run build` | 서버 + 웹 빌드 |
| `npm start` | 빌드된 백엔드 실행 |
| `npm run oauth:login` | (선택) ChatGPT 계정 OAuth 로그인 — 최초 1회 |
| `npm run oauth:proxy` | (선택) openai-oauth 프록시 실행 (켜둔 채 사용) |

---

## 클라우드 배포 (cloudtype 등 24시간 자동 발행)

로컬 PC 는 예약 시각에 꺼져 있을 수 있어 자동 발행이 안 됩니다. **항상 켜져 있는 서버**에 배포하면 매일 지정 시각에 자동 발행됩니다. 이 저장소에는 [cloudtype](https://cloudtype.io) 같은 **Docker 기반 무료 호스팅**에 바로 올릴 수 있도록 `Dockerfile` 이 포함되어 있습니다.

### 핵심 구조

- **단일 서비스**: 서버가 빌드된 프론트엔드(`web/dist`)까지 같이 서빙하므로 백엔드 한 개만 배포하면 대시보드도 같은 주소에서 열립니다. (같은 출처 → CORS 불필요)
- **브라우저 자동화**: 발행에는 Playwright(Chromium) 가 필요합니다. `Dockerfile` 은 브라우저가 내장된 공식 Playwright 이미지를 쓰고, 디스플레이가 없는 컨테이너에서도 **xvfb(가상 디스플레이)** 로 headful 크로미움을 띄워 카카오 봇 감지를 회피합니다.
- **로그인(세션) 이전**: 원격 서버는 로그인 창을 띄워 사용자가 직접 카카오 로그인을 할 수 없습니다. 그래서 **내 PC 에서 로그인 → 세션을 내보내기 → 클라우드에서 가져오기** 흐름을 사용합니다.

### 배포 순서

1. **GitHub 에 푸시** — 이 저장소를 본인 GitHub 저장소에 올립니다.

2. **cloudtype 에서 프로젝트 생성** → GitHub 저장소 연결 → **빌드 방식: Dockerfile** 선택.
   - **포트**: `3000` (Dockerfile 기본값. cloudtype 가 주입하는 `PORT` 를 자동 사용)
   - **환경변수**: 필요에 따라 아래를 설정합니다.

     | 변수 | 값(예) |
     | --- | --- |
     | `GEMINI_API_KEY` | (본인 Gemini 키) |
     | `OPENAI_API_KEY` | (선택, 본인 OpenAI 키) |
     | `GEMINI_MODEL` | `gemini-2.5-flash` |
     | `PW_HEADLESS` | `false` (기본값 유지 권장) |

   - **글감·DB는 이미지/git에 함께 배포됩니다**: `server/data/posts/*.md`(글감), `server/data/db.json`(글 메타데이터)이 포함되어 배포 시 로컬에서 만든 글감이 그대로 올라갑니다.
   - **`app-config.json`은 git/이미지에 포함하지 않습니다**: 이 파일에는 **OpenAI·Gemini API 키·텔레그램 봇 토큰**이 들어가 GitHub Push Protection에 걸립니다. API 키는 **환경변수**(`GEMINI_API_KEY`, `OPENAI_API_KEY` 등)로 주입하고, 화면 설정(블로그 이름·자동발행·텔레그램)은 배포 후 대시보드에서 다시 저장하거나 **영속 볼륨**으로 유지하세요.
   - **영속 볼륨(선택)**: 무료 컨테이너는 재배포/재시작 시 디스크가 초기화됩니다. **운영 중 서버에서 새로 만든 글/세션/설정**을 유지하려면 볼륨을 연결하세요.
     - `/app/server/.session` (로그인 세션 `state.json`)
     - `/app/server/data` (글/DB + **`app-config.json`** — 화면 입력 설정. API 키는 env 로, 나머지 설정은 이 볼륨에 저장)
     > `/app/server/data` 볼륨을 붙이면 빈 볼륨이 이미지에 구운 글감(`posts/`, `db.json`)을 가릴 수 있습니다. 이미지에 구운 글감을 그대로 쓰려면 볼륨 대신 git 에 포함된 데이터를 사용하세요.

3. **배포 완료 후 대시보드 접속** → **설정 탭에서 블로그 이름 저장**.

4. **내 PC 에서 로그인 & 세션 내보내기**
   - 로컬에서 `npm run dev` 로 실행 → 설정 탭 → **로그인** (브라우저 창에서 카카오 로그인).
   - 같은 설정 탭의 **세션 이전 → "세션 내보내기 (다운로드)"** 로 `tistory-session.json` 을 받습니다.

5. **클라우드 대시보드에서 세션 가져오기**
   - 클라우드 대시보드 설정 탭 → **세션 이전 → "세션 가져오기 (업로드)"** 로 방금 받은 `tistory-session.json` 을 올립니다.
   - "로그인됨" 으로 바뀌면 원격 서버도 발행할 수 있는 상태입니다.

6. **자동 발행 설정** → 주제/시각/개수 저장 → **자동 발행 켜짐** 토글 ON → 설정 저장.
   - 즉시 확인하려면 **"지금 즉시 발행"** 버튼으로 테스트하세요.

### 주의

- 카카오 세션은 시간이 지나면 만료될 수 있습니다. "로그아웃" 으로 바뀌면 4~5번을 다시 수행하세요.
- 무료 등급은 메모리/CPU 가 제한적이라 Chromium 발행이 느리거나 실패할 수 있습니다. 동시 발행은 직렬화되어 있어 한 번에 하나씩 처리합니다.
- `Dockerfile` 의 Playwright 태그(`v1.49.1-jammy`)는 `server/package.json` 의 `playwright` 버전과 맞춰야 합니다. 버전을 올리면 태그도 함께 변경하세요.

### 로컬에서 Docker 로 미리 검증 (선택)

```bash
docker build -t autoblog .
docker run -p 3000:3000 -e GEMINI_API_KEY=... autoblog
# http://localhost:3000 접속 → 설정에서 세션 가져오기
```

---

## 텔레그램 상태 알림 설정

서버(특히 클라우드)에 올려두고 **로그인 만료/발행 실패**를 놓치지 않도록, 일정 주기로 상태를 텔레그램으로 받아볼 수 있습니다.

### 봇 만들고 토큰·채팅 ID 얻기

1. 텔레그램에서 **@BotFather** 와 대화 → `/newbot` → 안내대로 봇 생성 → **봇 토큰**(`123456:ABC-...`)을 받습니다.
2. 방금 만든 **내 봇과 대화를 시작**(아무 메시지나 전송)합니다.
3. 브라우저에서 `https://api.telegram.org/bot<봇토큰>/getUpdates` 접속 → 응답 JSON 의 `result[].message.chat.id` 값이 **채팅 ID** 입니다.

### 적용 (화면 입력 권장)

- 대시보드 **설정 탭 → 텔레그램 상태 알림** 에서 **봇 토큰 · 채팅 ID** 를 입력하고 **"텔레그램 설정 저장"** 을 누릅니다.
  - 저장 즉시 모니터가 재시작되어 새 설정이 적용됩니다(서버 재시작 불필요).
  - 토큰은 화면에 다시 노출되지 않습니다. 변경할 때만 입력하고, 비우면 기존 토큰이 유지됩니다(지우려면 `-` 입력).
  - **"테스트 알림 보내기"** 로 즉시 동작을 확인할 수 있습니다.
- 입력값은 `server/data/db.json` 과 `app-config.json` 에 저장되어 재시작/재배포 후에도 유지됩니다.

### 알림 종류별 스위치 + 개별 주기

같은 패널의 **"알림 종류별 설정"** 에서 종류마다 **on/off 스위치**와 **주기(분)** 를 따로 지정합니다.

| 종류 | 설명 | 기본 주기 |
| --- | --- | --- |
| **정기 상태 보고** (`heartbeat`) | 서버 정상 여부·로그인 상태·글 통계(예약/실패/완료) 요약 보고 | 360분 |
| **로그인 만료 경고** (`loginAlert`) | 주기마다 세션을 점검해, 로그아웃 상태면 경고(복구되면 알림) | 60분 |
| **발행 실패 알림** (`failureAlert`) | 주기마다 실패 글을 점검해 건수를 알리고 자동 재발행 시도 | 60분 |

- 스위치를 끄면 해당 종류는 전송되지 않습니다. 각 주기는 1~1440분 사이로 설정합니다.
- 내부적으로는 1분마다 도는 마스터 틱이 종류별 주기 도래 여부를 판정해 보냅니다. (세션 점검은 한 틱당 1회만 수행해 중복 브라우저 실행을 막습니다)

> (선택) 환경변수 폴백: 토큰/채팅 ID는 화면 입력이 비어 있을 때만 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`(`server/.env` 또는 클라우드 환경변수)가 사용됩니다. 종류별 on/off·주기는 화면(설정 파일) 값만 사용합니다. (`TELEGRAM_NOTIFY_MINUTES` 는 구버전 단일 주기용으로, 이제 화면 설정의 정기 보고 주기로 대체됩니다.)

### 알림 내용

- 서버 동작 여부, **로그인 여부**(실제 세션 점검), 자동 발행 ON/OFF, **예약 대기/실패/발행완료 글 수**, 점검 시각.
- 로그인이 풀리면 즉시 별도 경고를 보내고, 점검 시 실패 글이 있으면 자동으로 재발행을 시도합니다.

---

## ChatGPT 계정 OAuth(openai-oauth)로 OpenAI 쓰기

OpenAI **API 크레딧 결제 없이**, 보유 중인 **ChatGPT 계정의 OAuth 토큰(Codex)** 으로 글/키워드 생성을 돌리고 싶을 때 사용하는 방식입니다. [openai-oauth](https://github.com/EvanZhouDev/openai-oauth) 라는 로컬 프록시가 `http://127.0.0.1:10531/v1` 에 **OpenAI 호환 엔드포인트**를 띄워 주며, 별도 API 키가 필요 없습니다.

> 이 방식은 **선택 사항**입니다. 그냥 OpenAI/Gemini API 키를 쓸 거라면 이 섹션은 건너뛰어도 됩니다.

### 단계

1. **로그인 (최초 1회)** — ChatGPT 계정으로 로그인해 `~/.codex/auth.json` 을 생성합니다.

```bash
npm run oauth:login
```

2. **프록시 실행** — 사용하는 동안 이 터미널은 **켜둔 채로** 둡니다. (별도 터미널 창 권장)

```bash
npm run oauth:proxy
```

3. **AutoBlog 설정** — 대시보드 **자동 발행** 탭(또는 `server/.env`)에서:
   - **OpenAI Base URL** = `http://127.0.0.1:10531/v1`
   - **OpenAI 모델** = `gpt-5.4` 등 **Codex 플랜에서 제공되는 모델** (기존 `gpt-4o-mini` 는 프록시에서 미제공일 수 있음)
   - **API 키는 비워둬도 됨** (OAuth 토큰을 사용)

   `.env` 로 설정하는 경우:
   ```bash
   OPENAI_BASE_URL=http://127.0.0.1:10531/v1
   OPENAI_MODEL=gpt-5.4
   # OPENAI_API_KEY 는 비워둬도 됨
   ```

4. 이제 평소처럼 **자동 발행**(키워드 생성 / 지금 1회 실행 / 자동 스케줄)을 사용하면 됩니다.

> ⚠️ openai-oauth 는 **비공식 커뮤니티 프로젝트**로 OpenAI 와 무관하며, 개인용 로컬 실험 용도로만 사용하세요. `~/.codex/auth.json` 의 토큰은 **비밀번호급 자격증명**이므로 외부에 노출하지 마세요. 제공되는 모델은 Codex 플랜에 따라 달라집니다.

---

## 사용법 (단계별)

1. **설정 탭 → 블로그 이름 저장**
   `myblog.tistory.com` 이면 `myblog` 만 입력합니다.

2. **설정 탭 → 로그인**
   버튼을 누르면 실제 브라우저 창이 열립니다. 창에서 **직접 티스토리(카카오) 로그인**을 완료하세요.
   로그인이 감지되면 세션이 저장되고 "로그인됨" 상태로 바뀝니다. (최대 5분 대기)

3. **새 글 탭 → 글 작성**
   - `.md 파일 불러오기` 로 기존 파일을 가져오거나 직접 작성
   - 제목(비우면 본문 첫 제목/파일명에서 자동 추론), 태그, 공개 범위 설정
   - **예약 발행 시각**을 지정하면 예약 상태로 저장됩니다.

4. **스케줄러 ON 확인** (상단 우측 배지)
   기본적으로 서버 시작 시 자동으로 켜집니다. 예약 시각이 되면 자동 발행됩니다.

5. **글 목록 탭에서 상태 확인**
   예약됨 → 발행 중 → 발행 완료(URL 표시). 실패 시 사유가 표시되며 **즉시 발행**으로 재시도할 수 있습니다.

---

## 자동 발행 (ChatGPT 오토파일럿)

글을 직접 쓰지 않고 **AI(ChatGPT/Gemini)가 키워드 선정부터 글 작성·발행까지 전부 자동**으로 수행합니다.
수익형 블로그에 맞춰 광고 수익(CPC/검색량) 관점의 키워드를 매달 정하고, 매일 정해진 시각에 여러 개의 글을 만들어 발행합니다.

**AI 자동 전환(failover)**: OpenAI 와 Gemini 키를 모두 등록하면, 글 생성 시 한쪽이 실패(할당량 초과/오류)할 경우 **자동으로 다른 쪽으로 전환**해 진행합니다. (우선순위 없이 호출에 성공하는 쪽 사용)
각 AI 의 **누적 사용 토큰·사용 가능 여부**는 자동 발행 탭의 "AI 상태" 패널에서 확인할 수 있습니다.
> 참고: OpenAI·Gemini 모두 잔여 토큰(잔액) 조회 API 를 제공하지 않아, 정확한 잔여량 대신 누적 사용량과 마지막 호출 성공 여부를 표시합니다.

### 동작 흐름
1. **매달**: ChatGPT 가 블로그 주제(니치)에 맞는 수익형 키워드 목록을 선정해 "이번 달 키워드 계획"으로 저장.
2. **매일 지정 시각(기본 오전 10:00, Asia/Seoul)**: 미사용 키워드 중 `하루 발행 수`(기본 2개)만큼 골라,
   각 키워드로 **제목·본문(마크다운)·태그**를 생성하고 기존 발행 파이프라인으로 티스토리에 자동 발행.
3. 사용한 키워드는 "사용됨"으로 표시되고, 모두 소진되면 자동으로 키워드를 보충합니다.

### 사용법
1. **자동 발행 탭** 으로 이동.
2. **OpenAI API 키** 입력(또는 `.env` 의 `OPENAI_API_KEY`), **블로그 주제/니치**, 타깃 독자, 하루 발행 수, 실행 시각, 공개 범위, 모델을 설정하고 **설정 저장**.
3. **키워드 생성/재생성** 으로 이번 달 키워드 계획을 만든 뒤 내용을 확인.
4. 즉시 실행은 두 가지입니다.
   - **지금 즉시 발행**(상단 녹색 버튼): AI 호출 없이 **이미 만들어 둔 미발행 글**(초안/예약/실패) 중 오래된 순으로 `하루 발행 수`만큼 바로 발행. (AI 토큰 절약)
   - **AI 생성 후 1회 실행**(키워드 계획 옆 버튼): AI 로 새 글을 생성해 발행(매일 스케줄과 동일).
5. 상단의 **자동 발행 켜짐** 토글을 켠 뒤 **설정 저장**하면(체크만 하고 저장 안 하면 적용 안 됨), 매일 지정 시각에 자동으로 실행됩니다.
   - 그 시각에 서버가 꺼져 있었더라도, 서버가 켜지면 그날 안에 한 번 따라잡아(catch-up) 실행됩니다.

> 전제: 자동 발행도 티스토리 로그인 세션을 사용하므로, **설정 탭에서 로그인**이 되어 있어야 합니다.
> 발행은 브라우저 창을 띄우는 방식이므로 PC 가 켜져 있고 로그인 세션이 유효해야 합니다.

## Markdown 작성 규칙

본문은 일반 마크다운을 사용하며, 파일 상단에 **front-matter**(선택)로 메타데이터를 넣을 수 있습니다.

```markdown
---
title: 첫 번째 글
tags: [개발, 티스토리]
---

# 본문 제목

내용을 마크다운으로 작성합니다.

- 목록
- **굵게**, _기울임_

```js
console.log("코드 블록도 지원");
```
```

- `title` 이 없으면 본문 첫 번째 `# 헤딩` → 파일명 순으로 제목을 추론합니다.
- `tags` 는 배열(`[a, b]`) 또는 콤마 문자열(`a, b`) 모두 가능합니다.

---

## 환경변수 설정

`server/.env.example` 를 `server/.env` 로 복사해 조정합니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `4000` | 백엔드 포트 |
| `WEB_ORIGIN` | `http://localhost:5173` | CORS 허용 출처 |
| `SCHEDULER_CRON` | `* * * * *` | 예약 글 확인 주기 (cron) |
| `SCHEDULER_AUTOSTART` | `true` | 서버 시작 시 스케줄러 자동 실행 |
| `PW_HEADLESS` | `false` | `true` 면 발행 시 브라우저를 숨김(headless). 단 티스토리/카카오가 봇으로 감지해 로그인 페이지로 튕길 수 있어 **`false`(창 표시) 권장** |
| `OPENAI_API_KEY` | (없음) | ChatGPT 자동 글 생성용 API 키. UI(자동 발행 탭)에서 입력해도 됨. OAuth 프록시 사용 시 비워도 됨 |
| `OPENAI_MODEL` | `gpt-4o-mini` | 글/키워드 생성에 쓸 OpenAI 모델. OAuth 프록시 사용 시 `gpt-5.4` 등 Codex 모델 |
| `OPENAI_BASE_URL` | (없음=공식 API) | OpenAI 호환 Base URL. openai-oauth 프록시를 쓰려면 `http://127.0.0.1:10531/v1` |
| `GEMINI_API_KEY` | (없음) | Google Gemini API 키. OpenAI 와 함께 등록 시 토큰 남은 쪽으로 자동 전환 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 글/키워드 생성에 쓸 Gemini 모델 |
| `TELEGRAM_BOT_TOKEN` | (없음) | (폴백) 텔레그램 봇 토큰. **화면 입력이 우선**, 비었을 때만 사용 |
| `TELEGRAM_CHAT_ID` | (없음) | (폴백) 알림 받을 채팅 ID. **화면 입력이 우선** |
| `TELEGRAM_NOTIFY_MINUTES` | `360` | (폴백) 상태 점검/알림 주기(분). **화면 입력이 우선** |
| `APP_CONFIG_FILE` | `server/data/app-config.json` | 화면 입력 설정을 저장하는 파일 경로. 영속 볼륨 경로로 바꾸면 재배포 후에도 유지 |

> 텔레그램·자동발행·블로그 이름 등 **화면에서 입력한 설정은 `app-config.json` 파일에 저장**되며, 서버 시작 시 이 파일을 읽어 복원합니다(환경변수보다 우선). 자세한 내용은 [설정 영속화](#설정-영속화-화면-입력-설정-파일-저장) 참고.

---

## REST API 명세

기본 경로: `http://localhost:4000`

### 글 (Posts)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/posts` | 글 목록 |
| GET | `/api/posts/:id` | 글 상세 (마크다운 + 변환된 HTML 포함) |
| POST | `/api/posts` | 글 생성 (JSON 본문) |
| POST | `/api/posts/upload` | `.md` 파일 업로드로 생성 (multipart) |
| PUT | `/api/posts/:id` | 글 수정 (`scheduledAt: null` 이면 예약 해제) |
| DELETE | `/api/posts/:id` | 글 삭제 |
| POST | `/api/posts/:id/publish` | 즉시 발행 |

### 설정 (Settings)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/settings` | 설정 조회 |
| PUT | `/api/settings` | 블로그 이름 저장 |
| POST | `/api/settings/login` | 대화형 로그인 (브라우저 열림, 완료까지 대기) |
| POST | `/api/settings/check-session` | 저장된 세션 유효성 확인 |
| GET | `/api/settings/session/export` | 로그인 세션(state.json) 다운로드 |
| POST | `/api/settings/session/import` | 내보낸 세션 JSON 업로드·적용 (클라우드 배포용) |

> 로그인/세션 확인/세션 가져오기가 성공하면, 실패 상태로 남아 있던 글을 백그라운드에서 순차 재발행합니다.

### 스케줄러 (Scheduler)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/scheduler` | 실행 상태 |
| POST | `/api/scheduler/start` | 시작 |
| POST | `/api/scheduler/stop` | 중지 |

### 자동 발행 (Autopilot · ChatGPT)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/autopilot` | 설정 + 이번 달 키워드 계획 + 스케줄러 상태 |
| PUT | `/api/autopilot` | 설정 변경 (주제/시각/개수/모델/API 키 등) |
| POST | `/api/autopilot/keywords` | 이번 달 키워드 강제 재생성 |
| POST | `/api/autopilot/run` | AI 로 새 글 생성 + 발행 (1회) |
| POST | `/api/autopilot/run-existing` | **AI 호출 없이** 이미 만든 미발행 글 `postsPerDay` 개 발행 |

### AI 상태 (OpenAI / Gemini)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/ai` | 제공자별 상태(설정 여부/사용 가능/누적 사용 토큰/요청 수) |
| POST | `/api/ai/check` | 각 제공자에 가벼운 핑을 보내 사용 가능 여부 갱신 |

### 모니터링 (텔레그램)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/monitor` | 텔레그램 알림 상태(설정 여부/채팅 ID/토큰 보유/폴백 여부 + 종류별 on·주기) |
| PUT | `/api/monitor` | 텔레그램 설정 저장(토큰/채팅 ID + 종류별 on·주기) 후 모니터 재시작 |
| POST | `/api/monitor/test` | 현재 상태를 즉시 점검해 텔레그램으로 테스트 전송 |

### 기타
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/health` | 헬스 체크 |

---

## 데이터 저장 위치

모두 `server/` 하위에 생성되며, `.gitignore` 처리되어 있습니다.

| 경로 | 내용 |
| --- | --- |
| `server/data/db.json` | 글 메타데이터 + 키워드 계획 + AI 사용량 등 운영 데이터 (lowdb) |
| `server/data/app-config.json` | **화면에서 입력한 설정**(블로그 이름 + 자동발행 + 텔레그램). **API 키·봇 토큰 포함 → git 제외**. 클라우드에서는 볼륨 또는 배포 후 화면에서 재설정 |
| `server/data/posts/*.md` | 글 마크다운 원본 |
| `server/.session/state.json` | 로그인 세션 스냅샷(storageState, 세션 쿠키 포함) |
| `server/screenshots/` | 발행 실패 시 디버깅 스크린샷 |

---

## 설정 영속화 (화면 입력 설정 파일 저장)

대시보드 화면에서 입력한 **설정**은 운영 데이터(`db.json`)와 분리된 **전용 파일 `app-config.json`** 에 저장됩니다. 덕분에 프로그램을 수정/재배포해도 이 파일만 있으면 설정이 그대로 복원됩니다.

### 저장되는 항목

- **블로그 이름** (설정 탭)
- **자동 발행 설정** — 주제/타깃/시각/개수/공개범위, OpenAI·Gemini 모델·API 키·Base URL (자동 발행 탭)
- **텔레그램 설정** — 봇 토큰/채팅 ID/알림 주기 (설정 탭)

> 로그인 세션은 별도로 `server/.session/state.json` 에 저장됩니다. 발행한 글 본문/메타데이터·키워드 계획·AI 사용량은 `db.json` 에 남습니다.

### 동작 방식

1. **저장**: 위 항목을 화면에서 저장할 때마다 `app-config.json` 에 즉시(원자적 쓰기로) 기록합니다.
2. **복원**: 서버 시작 시 `app-config.json` 이 있으면 그 값으로 설정을 덮어써 복원합니다(**설정 파일이 환경변수보다 우선**). 파일이 없으면 현재 설정으로 새로 만듭니다.

### 경로 / 재배포 시 유지

- 기본 경로: `server/data/app-config.json`
- 환경변수 `APP_CONFIG_FILE` 로 경로 변경 가능 → **영속 볼륨 경로**를 지정하면 클라우드 재배포 후에도 유지됩니다.
- cloudtype 등에서는 `/app/server/data` 볼륨을 연결하면 이 파일이 그대로 보존됩니다. ([클라우드 배포](#클라우드-배포-cloudtype-등-24시간-자동-발행) 참고)

> ⚠️ 이 파일에는 API 키·봇 토큰 등 **민감 정보**가 포함됩니다. **`.gitignore` 로 git 에 올리지 않습니다.** (GitHub Push Protection) 클라우드에서는 `/app/server/data` **영속 볼륨**에 두거나, API 키는 **환경변수**로 주입하세요.

---

## 문제 해결 (트러블슈팅)

- **발행이 실패해요 / "글을 찾을 수 없습니다" 외 셀렉터 오류**
  티스토리 에디터 DOM은 수시로 바뀝니다. `server/src/tistory.ts` 상단의 `SELECTORS` 상수를 실제 화면에 맞게 수정하세요.
  처음 테스트할 때는 `server/.env` 에서 `PW_HEADLESS=false` 로 두고 브라우저 동작을 눈으로 확인하는 것을 권장합니다.
  실패 시 `server/screenshots/` 에 스크린샷이 남습니다.

- **"로그인 세션이 만료되었습니다"**
  설정 탭에서 다시 **로그인**하세요. 세션은 시간이 지나면 만료될 수 있습니다.

- **Chromium 다운로드 실패**
  ```bash
  npx playwright install chromium
  ```

- **포트 충돌 (4000/5173)**
  `server/.env` 의 `PORT`, `web/vite.config.ts` 의 `server.port` 를 변경하세요.

---

## 주의사항 / 한계

- 본 프로그램은 티스토리 **비공식** 자동화 방식을 사용합니다. 티스토리 정책/화면 변경 시 동작이 중단될 수 있으며, 그에 따른 책임은 사용자에게 있습니다.
- 로그인 세션 쿠키가 로컬에 저장되므로 `server/.session` 디렉터리 보안에 유의하세요.
- 카테고리 지정은 현재 카테고리 ID 직접 입력 방식이며, 블로그 카테고리 목록 자동 조회 UI는 포함되어 있지 않습니다(추가 가능).
- 본문 내 이미지 자동 업로드는 미구현입니다(추가 가능).

---

## 작업 기록 (변경 이력)

> 이 프로젝트에 적용한 모든 작업/변경 사항을 시간순으로 기록합니다. (최신 항목이 위)

### 2026-06-23 — 텔레그램 알림 종류별 스위치/주기 + 글감·설정 배포 포함

**목표**
- ① 텔레그램 알림을 종류별로 전송 on/off 스위치로 선택, ② 알림 주기를 종류별로 다르게 설정, ③ 만들어진 글감 파일과 설정 파일을 배포에 함께 포함.

**① 종류별 스위치 + 개별 주기**
- `types.ts`: `TelegramChannel{enabled, intervalMinutes}` 신설. `TelegramConfig` 를 `heartbeat`/`loginAlert`/`failureAlert` 3채널 구조로 변경(단일 `intervalMinutes` 제거).
- `db.ts`: 구버전(평면 `intervalMinutes`) → `heartbeat.intervalMinutes` 로 이전하는 마이그레이션 추가.
- `notifier.ts`: 채널별 단일 타이머 → **1분 마스터 틱**으로 전환. 채널별 마지막 전송 시각을 추적해 주기 도래 시에만 전송. 세션 점검은 한 틱당 1회만 수행. `monitorStatus` 가 채널별 on/주기를 반환.
- `routes/monitor.ts`: `PUT /api/monitor` 가 토큰/채팅 ID + 채널별 `enabled`/`intervalMinutes` 를 받도록 확장.
- 프론트(`api.ts`, `SettingsPage.tsx`): 설정 탭에 종류별 **토글 스위치 + 주기(분) 입력** 3행 추가(`Toggle` 컴포넌트).

**③ 글감 배포 포함 (설정 파일은 git 제외)**
- `.gitignore`/`.dockerignore`: `server/data/posts/`(글감), `server/data/db.json`(글 메타)은 배포에 **포함**. `app-config.json`은 API 키·봇 토큰 포함으로 **git/이미지에서 제외**(GitHub Push Protection 대응).
- README: 배포 가이드에 env 주입·볼륨으로 설정 유지 안내.

**효과**: 종류마다 보낼지/얼마나 자주 보낼지 따로 정할 수 있고, 글감은 배포에 포함되며 API 키는 git 에 노출되지 않음.

### 2026-06-23 — 화면 입력 설정의 파일 영속화(app-config.json)

**목표**
- 화면에서 입력한 설정을 전용 파일에 기록하고, 프로그램 수정·재배포 후에도 파일을 읽어 설정을 유지.

**변경**
- `config.ts`: `paths.appConfig` 추가(기본 `server/data/app-config.json`, 환경변수 `APP_CONFIG_FILE` 로 변경 가능).
- `config.store.ts` 신규: 화면 입력 설정(블로그 이름 + 자동발행 설정 + 텔레그램 설정)만 `app-config.json` 에 영속화.
  - `savePersistedConfig()`: 원자적 쓰기(temp→rename)로 저장.
  - `initPersistedConfig()`: 서버 시작 시 파일이 있으면 그 값으로 DB 설정을 복원(**파일이 환경변수보다 우선**), 없으면 새로 생성. `initDb()` 직후 `index.ts` 에서 호출.
- 설정 변경 라우트에 저장 연결: `routes/settings.ts`(블로그 이름), `routes/autopilot.ts`(자동발행), `routes/monitor.ts`(텔레그램) — 각 저장 후 `savePersistedConfig()` 호출.
- README: 데이터 저장 위치/환경변수/폴더 구조/클라우드 볼륨 안내에 반영하고, "설정 영속화" 섹션 신설.

**효과**: `db.json`(운영 데이터)과 분리된 `app-config.json`(설정)만 영속 볼륨에 두면, 재배포 후에도 자동발행·텔레그램·블로그 이름 설정이 그대로 복원됨.

**검증**: 서버 타입체크 통과, 웹 빌드 통과, 린트 오류 없음.

### 2026-06-23 — 텔레그램 설정을 화면 입력 방식으로 전환

**목표**
- `.env` 가 아니라 대시보드 화면에서 텔레그램 봇 토큰/채팅 ID/알림 주기를 입력·저장하도록 변경. (env 는 폴백으로만 유지)

**변경**
- `types.ts`: `TelegramConfig`(botToken/chatId/intervalMinutes) + `DEFAULT_TELEGRAM` 추가, `DbSchema`/`DEFAULT_DB` 에 `telegram` 포함.
- `db.ts`: 기존 DB 에 `telegram` 기본값 보정(마이그레이션).
- `notifier.ts`: `effectiveTelegram()` 으로 **DB(화면) 값 우선, 비면 env 폴백**. `startMonitor(startup?)`/`restartMonitor()` 추가(설정 저장 시 무중단 재시작). `monitorStatus()` 에 `hasToken`/`chatId`/`fromEnv` 추가(토큰 값은 비노출).
- `routes/monitor.ts`: `PUT /api/monitor` 추가 — 토큰(빈 값=유지, `-`=삭제)/채팅 ID/주기 저장 후 모니터 재시작.
- 프론트(`api.ts`, `SettingsPage.tsx`): 설정 탭의 텔레그램 패널에 **봇 토큰(비밀)·채팅 ID·알림 주기 입력 + "텔레그램 설정 저장"** 추가. env 로만 설정된 경우 안내 배지 표시.
- `.env(.example)`: 텔레그램 항목을 "선택·폴백(화면 입력 우선)" 으로 주석 변경.

**검증**: 서버 타입체크 통과, 웹 빌드 통과, 린트 오류 없음.

### 2026-06-23 — 실패 글 자동 재발행 + 텔레그램 모니터링 + 즉시 발행(기존 글)

**목표**
- ① 발행 실패 글을 재로그인/서버 재시작 시 순차 재발행, ② 일정 주기로 로그인·서버 상태를 텔레그램 알림, ③ "지금 즉시 발행"은 AI 재호출 없이 이미 만든 글을 발행, ④ 작업 내역을 README 에 기록.

**① 실패 글 자동 재발행** (`server/src/publisher.service.ts`, `index.ts`, `routes/settings.ts`)
- `retryFailedPosts({ includeStuck, reason })` 추가: 상태가 `failed`(옵션으로 멈춘 `publishing` 포함)인 글을 `updatedAt` 오래된 순으로 모아 `publishPostById` 로 순차 재발행. 모듈 변수 `retrying` 으로 중복 실행 방지. 세션 만료가 감지되면 즉시 중단.
- 트리거: **서버 시작 시**(`bootstrapRetry` — `checkSession` 으로 로그인 갱신 후 `includeStuck:true` 로 재발행), **재로그인/세션 확인/세션 가져오기 성공 시**(백그라운드 `void` 호출), **정기 점검 시**(아래 모니터).

**② 텔레그램 상태 알림** (`server/src/notifier.ts`, `routes/monitor.ts`, `config.ts`, `.env`)
- `setInterval` 기반 모니터(`startMonitor`): `TELEGRAM_NOTIFY_MINUTES`(기본 360분)마다 `collectHealth` 로 로그인 여부(`checkSession`)·서버 상태·글 통계(예약/실패/완료)를 점검해 텔레그램(`sendTelegram`)으로 보고. 서버 시작 시 시작 메시지 전송.
- 로그인 상태가 true→false 로 바뀌면 즉시 경고. 점검 중 로그인 상태이고 실패 글이 있으면 `retryFailedPosts` 자동 호출.
- 환경변수 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_NOTIFY_MINUTES`. 미설정 시 조용히 비활성화.
- API: `GET /api/monitor`(상태), `POST /api/monitor/test`(테스트 전송). 설정 탭에 "텔레그램 상태 알림" 패널 + 테스트 버튼 추가.

**③ 즉시 발행(기존 글)** (`server/src/autopilot.ts`, `routes/autopilot.ts`, 프론트)
- `publishExistingNow()` 추가: AI 호출 없이 미발행 글(`draft`/`scheduled`/`failed`) 중 `createdAt` 오래된 순으로 `postsPerDay` 개를 발행. `POST /api/autopilot/run-existing`.
- 자동 발행 탭 상단 **"지금 즉시 발행"** 버튼을 이 동작으로 연결. 기존 AI 생성 버튼은 **"AI 생성 후 1회 실행"** 으로 라벨 변경(`/api/autopilot/run` 유지).

**④ README**: 위 기능을 구현 기능/폴더 구조/환경변수/REST API/사용법/변경 이력에 모두 반영.

**검증**: 서버 타입체크 통과, 웹 빌드 통과, 린트 오류 없음.

### 2026-06-23 — 자동 발행 시각 누락 수정 + 즉시 발행 버튼 + 클라우드 배포 지원

**목표**
- ① 설정한 시각에 자동 발행이 안 되는 문제 수정, ② 시각과 무관하게 바로 실행하는 버튼 추가, ③ cloudtype 등 24시간 호스팅 배포 준비.

**①  자동 발행 시각 판정 수정** (`server/src/autopilot.ts`)
- 기존엔 현재 시각이 예약 시각과 **정확히 일치(===)** 하는 1분에만 실행 → 그 순간 서버가 꺼져 있거나 tick 이 밀리면 그날 영영 실행 안 됨.
- **"예약 시각 경과(>=) + 오늘 미실행"** 으로 변경. 시각을 놓쳐도 서버가 켜진 뒤 그날 안에 따라잡아(catch-up) 1회 실행한다. (중복 실행은 `lastRunDate` 로 방지)

**② 지금 즉시 발행 버튼** (`web/src/pages/AutopilotPage.tsx`)
- 자동 발행 탭 상단에 예약 시각과 무관하게 바로 글을 생성·발행하는 **"지금 즉시 발행"** 버튼 추가. (기존 `POST /api/autopilot/run` 재사용)

**③ 클라우드 배포 지원**
- 서버가 빌드된 프론트엔드(`web/dist`)를 함께 정적 서빙 + SPA 폴백, `0.0.0.0` 바인딩. (`server/src/index.ts`, `config.ts`) → 단일 서비스로 배포 가능.
- **세션 이전 기능**: 원격 서버는 로그인 창을 못 띄우므로, 로컬에서 로그인한 세션(`state.json`)을 **내보내기/가져오기** 하는 API(`GET/POST /api/settings/session/export|import`)와 설정 화면 UI 추가.
- `Dockerfile`(공식 Playwright 이미지 + xvfb 가상 디스플레이)·`.dockerignore` 추가 → 디스플레이 없는 컨테이너에서도 headful 발행 가능.
- README 에 cloudtype 배포 가이드 추가.

**검증**: 서버 타입체크 통과, 웹 빌드 통과, 린트 오류 없음.

### 2026-06-22 — 다른 컴퓨터에서 Gemini 미작동 수정 (기본 모델/설정 이전)

**증상**: 한 PC 에서 잘 되던 Gemini 자동 발행이 다른 PC 에서 안 됨.

**원인**
- API 키·설정은 git 제외 파일(`server/.env`, `server/data/db.json`)에 저장되어 **다른 컴퓨터로 옮기면 사라짐**.
- 기본 Gemini 모델이 코드마다 불일치(`types.ts`=`gemini-2.0-flash`, `config.ts`/`.env.example`=`gemini-2.5-flash`). 게다가 `gemini-2.0-flash` 는 무료 등급 한도가 0(limit:0)인 키 프로젝트가 많아 429.

**해결**
- 새 DB 기본 Gemini 모델을 `gemini-2.5-flash` 로 통일(`types.ts`), 레거시 `gemini-2.0-flash` 를 자동 보정하는 마이그레이션 추가(`db.ts`), `.env.example` 주석 정리.
- Vite 프록시 대상을 `127.0.0.1` 로 고정하고 백엔드 부팅 전 `ECONNREFUSED` 스택 트레이스를 억제하는 에러 핸들러 추가(`web/vite.config.ts`).

**조치(사용자)**: 새 컴퓨터에서는 `server/.env` 또는 UI 에 Gemini 키를 다시 입력. 키는 https://aistudio.google.com/apikey 에서 "새 프로젝트로 API 키 생성" 권장.

### 2026-06-19 — Gemini 추가 + AI 자동 전환(failover) + 사용량 표시

**목표**
- OpenAI 무료 토큰 소진에 대비해 Google Gemini 를 추가하고, 토큰이 남아 호출에 성공하는 AI 로 자동 전환. 각 AI 의 사용량/상태를 화면에서 확인.

**중요 제약**
- OpenAI·Gemini 모두 "잔여 토큰(잔액)" 조회 API 를 제공하지 않음. 따라서 정확한 잔여량 대신 **누적 사용 토큰 + 마지막 호출 성공 여부(사용 가능/불가)** 를 표시.

**추가/변경**
- 환경변수 `GEMINI_API_KEY`, `GEMINI_MODEL`(기본 `gemini-2.0-flash`) 추가. (`config.ts`)
- `server/src/ai.ts` 전면 개편: OpenAI(SDK) + Gemini(REST fetch, 무의존성) 프로바이더 추상화. 키가 등록된 제공자를 사용 가능 순으로 시도하고 실패 시 **자동 failover**. 각 호출의 usage(토큰)를 누적 집계. 제공자 상태 점검(`checkProvider`/`checkAllProviders`)과 상태 조회(`getAiStatus`) 제공.
- `types.ts`/`db.ts`: `AutopilotConfig` 를 `openai`/`gemini` 프로바이더별 설정으로 재구성하고, `aiUsage`(제공자별 누적 사용량/상태) 추가. 구버전(단일 OpenAI 평면 필드) → 멀티 프로바이더 **자동 마이그레이션**.
- `routes/autopilot.ts`: 설정 입출력을 프로바이더별 구조로 변경(키는 노출 안 함). `routes/ai.ts` 신규: `GET /api/ai`, `POST /api/ai/check`.
- 프론트엔드 자동 발행 탭: OpenAI/Gemini **각각의 모델·API 키 입력란**, **"AI 상태·사용량" 패널**(누적 토큰/사용 가능 배지/오류, "상태 확인" 버튼) 추가.

**검증**: 서버 타입체크 통과, 웹 빌드 통과, 린트 무오류. 임시 인스턴스에서 `GET /api/ai`(프로바이더 상태) 및 `GET /api/autopilot`(프로바이더별 키 마스킹) 정상 응답 확인. 기존 OpenAI 키가 신규 구조로 자동 마이그레이션됨을 확인.

### 2026-06-19 — ChatGPT 자동 발행(오토파일럿) 기능 추가

**목표**
- 글을 사람이 쓰지 않고 ChatGPT 가 수익형 키워드 선정 → 글(제목/본문/태그) 작성 → 매일 정해진 시각(기본 오전 10시)에 하루 2개씩 자동 발행.

**추가/변경**
- 의존성: `openai` 추가. 환경변수 `OPENAI_API_KEY`, `OPENAI_MODEL`(기본 `gpt-4o-mini`) 추가.
- `server/src/ai.ts` 신규: ChatGPT 로 (1) 월간 수익형 키워드 선정, (2) 키워드 기반 글 생성(JSON 출력).
- `server/src/autopilot.ts` 신규: Asia/Seoul 기준 매 분 시각을 확인하는 스케줄러. 지정 시각·하루 1회만 실행, 매달 키워드 계획 자동 생성/보충, `postsPerDay` 만큼 글 생성 후 기존 발행 파이프라인으로 발행. 수동 1회 실행/키워드 재생성 함수 제공.
- `server/src/types.ts` / `db.ts`: DB 스키마에 `autopilot`(설정) + `keywordPlan`(월간 키워드) 추가 및 기존 DB 자동 보정.
- `server/src/routes/autopilot.ts` 신규: `GET/PUT /api/autopilot`, `POST /api/autopilot/keywords`, `POST /api/autopilot/run`. API 키는 응답에 노출하지 않고 설정 여부만 반환.
- `index.ts`: 서버 시작 시 오토파일럿 스케줄러 자동 시작.
- 프론트엔드: **자동 발행** 탭(`web/src/pages/AutopilotPage.tsx`) 추가 — 주제/시각/개수/모델/API 키 설정, 키워드 계획 조회·재생성, 즉시 실행, 최근 실행 결과 표시. 내비게이션/라우팅/`api.ts` 갱신.

**전제**: 자동 발행도 티스토리 로그인 세션을 사용하므로 설정 탭 로그인이 되어 있어야 함. OpenAI API 키 필요.

**검증**: 서버 타입체크 통과, 웹 프로덕션 빌드 통과, 임시 인스턴스에서 `GET /api/autopilot` 정상 응답(키 미노출) 및 오토파일럿 스케줄러 기동 확인.

### 2026-06-19 — 발행 후 본문이 비어있는 문제 수정 (TinyMCE 정식 API 사용)

**증상**
- 발행은 완료되지만, 발행된 글의 본문이 비어 있음.

**원인**
- TinyMCE iframe 의 `body.innerHTML` 을 직접 수정했으나, TinyMCE 는 발행 시 **내부 모델(`getContent`)** 기준으로 저장하므로 DOM 직접 수정이 반영되지 않아 본문이 빈 채로 저장됨.

**해결** (`server/src/tistory.ts` 의 `fillEditorContent` 만 수정)
- 기본모드 입력을 **TinyMCE 정식 API** 로 변경: `tinymce.activeEditor.setContent(html)` 후 `editor.save()` 로 내부 `<textarea>` 까지 동기화.
- CodeMirror 경로에도 `setValue()` 후 `save()` 호출을 추가해 textarea 동기화 보장.
- (그 외 로그인/세션/발행 등 정상 동작 부분은 변경하지 않음.)

**검증**: 서버 타입체크 통과, 린트 오류 없음.

### 2026-06-19 — 본문 입력 오류 수정 (에디터 자동 감지 + HTML 주입)

**증상**
- 로그인/제목 입력까지 정상 동작하나, 본문 입력 단계에서 `locator.click: Timeout 10000ms exceeded` 발생. CodeMirror(`cm-s-tistory-html`)가 `element is not visible` 로 클릭 실패.

**원인**
- 에디터 "마크다운 모드 전환" 셀렉터가 실제 DOM과 맞지 않아 모드 전환이 조용히 실패 → 숨겨진(비활성) CodeMirror 를 클릭하려다 타임아웃.
- 티스토리 에디터는 기본모드(TinyMCE iframe)/마크다운·HTML(CodeMirror)/ProseMirror 등 여러 형태가 혼재해 "모드 전환 후 입력" 방식 자체가 취약함.

**해결** (`server/src/tistory.ts`, `server/src/publisher.service.ts`, `server/tsconfig.json`)
- 모드 전환 제거. 마크다운을 **HTML 로 변환**한 뒤, **현재 활성 에디터를 자동 감지**해 본문을 직접 주입하는 `fillEditorContent()` 도입:
  1. TinyMCE iframe(`#editor-tistory_ifr`) → `body.innerHTML`
  2. CodeMirror → 인스턴스 `setValue()` + `refresh()`
  3. ProseMirror(`.ProseMirror`) → `innerHTML`
  4. `textarea#content` → `fill`
- `publisher.service` 가 `markdownToHtml` 로 변환한 HTML 을 함께 전달하도록 변경.
- 네이티브 다이얼로그 처리 개선: beforeunload 는 수락, "이어쓰기" 등 confirm 은 거절해 항상 새 글로 시작.
- `page.evaluate` 의 DOM 타입을 위해 server tsconfig `lib` 에 `DOM` 추가.

**검증**: 서버 타입체크 통과, 린트 오류 없음.

### 2026-06-19 — 세션 쿠키 유실 근본 수정 (storageState 도입)

**증상**
- headful(`PW_HEADLESS=false`)로 바꿔도 발행 시 "로그인 세션이 만료되었습니다" alert 이 계속 뜨고, 콘솔에 로그도 없음.

**원인 (근본)**
1. **세션 쿠키 유실**: `launchPersistentContext` 는 디스크 프로필에 쿠키를 저장하지만, 티스토리/카카오 로그인 쿠키 중 만료시간이 없는 **세션 쿠키는 디스크에 저장되지 않음**. 그래서 로그인 중(메모리)엔 로그인됨으로 보이다가, 발행용으로 새 컨텍스트를 열면 세션 쿠키가 사라져 로그아웃 상태가 됨.
2. **`maxRedirects: 0` 예외**: Playwright 버전에 따라 리다이렉트 시 예외를 던져, 로그인 상태인데도 세션 확인이 실패로 처리될 수 있었음.
3. 수동 발행 경로에 진행 로그가 없어 디버깅 정보가 부족했음.

**해결** (`server/src/tistory.ts`, `server/src/config.ts`)
- `launchPersistentContext` → **`browser.newContext({ storageState })`** 방식으로 전환. 로그인 성공/세션 확인/발행 성공 시 `ctx.storageState({ path })` 로 **세션 쿠키까지 포함한 스냅샷**을 `server/.session/state.json` 에 저장하고, 이후 복원해 재사용.
- 세션 확인(`isLoggedIn`)을 **리다이렉트를 끝까지 따라간 최종 URL 로 판정**하도록 변경(`maxRedirects:0` 제거).
- `[tistory] 세션확인...`, `[publish] 제목 입력/본문 입력/발행 진행/완료` 등 진행 로그 추가.

**필요 조치**: 세션 저장 형식이 바뀌었으므로 **설정 탭에서 한 번 다시 로그인**해야 `state.json` 이 생성됩니다.

**검증**: 서버 타입체크 통과, 린트 오류 없음.

### 2026-06-19 — 발행 중 "로그인 세션 만료" 오류 수정

**증상**
- 로그인 후 새 글을 발행하면 "로그인 세션이 만료되었습니다. 설정에서 다시 로그인해 주세요." alert 이 뜸.

**원인**
- 세션 확인(`ctx.request`)은 쿠키 기반 HTTP 요청이라 정상(로그인됨)으로 나오지만, **실제 발행은 에디터 페이지를 로드**해야 함.
- `PW_HEADLESS=true` 라서 발행이 **헤드리스 브라우저**로 실행 → 티스토리/카카오가 봇으로 감지해 쿠키가 유효해도 로그인 페이지(`/auth/login`)로 강제 리다이렉트 → 코드가 "세션 만료"로 오판정. (앞선 "세션 확인" 문제와 동일한 봇 감지 원인)

**해결** (`server/src/config.ts`, `server/src/tistory.ts`, `.env`)
- 발행 브라우저 기본값을 **headful(창 표시, `PW_HEADLESS=false`)** 로 변경 → 로그인 때와 동일 환경이라 봇 감지 회피.
- `openContext` 에 자동화 탐지 완화 옵션 추가(`ignoreDefaultArgs: ["--enable-automation"]`).
- 발행 전 `ctx.request` 로 세션을 먼저 확인하고, 그래도 로그인 페이지로 튕기면 "세션 만료"가 아니라 **헤드리스 봇 차단 안내 메시지**로 분기.
- `server/.env`, `server/.env.example` 의 `PW_HEADLESS` 기본값을 `false` 로 변경.

**검증**: 서버 타입체크 통과, 린트 오류 없음.

### 2026-06-22 — OpenAI 를 ChatGPT 계정 OAuth(openai-oauth)로 사용 지원

API 크레딧 결제 없이 **ChatGPT 계정의 OAuth 토큰(Codex)** 으로 OpenAI 를 호출할 수 있도록, [openai-oauth](https://github.com/EvanZhouDev/openai-oauth) 로컬 프록시 연동을 추가했다. 프록시는 `http://127.0.0.1:10531/v1` 에 **OpenAI 호환 엔드포인트**를 띄우며 API 키가 필요 없다.

**사용 방법**
1. `npm run oauth:login` — 최초 1회. `npx @openai/codex login` 으로 `~/.codex/auth.json` 생성(ChatGPT 로그인).
2. `npm run oauth:proxy` — `npx openai-oauth` 프록시 실행. **켜둔 채로** 사용.
3. 자동 발행 설정(또는 `.env`)에서:
   - **OpenAI Base URL** = `http://127.0.0.1:10531/v1`
   - **OpenAI 모델** = `gpt-5.4` 등 Codex 플랜에서 제공되는 모델 (기존 `gpt-4o-mini` 는 프록시에서 미제공일 수 있음)
   - API 키는 비워둬도 됨(OAuth 토큰 사용).

**코드 변경**
- `types.ts`: `AiProviderConfig.baseUrl?` 추가.
- `config.ts` / `.env`(.example): `OPENAI_BASE_URL` 추가.
- `ai.ts`:
  - `openaiBaseUrl()` / `openaiEnabled()` 추가 — base URL 만 있어도 OpenAI 를 "사용 가능 제공자"로 인식.
  - `callOpenAI()` 가 `baseURL` 을 받고, 키가 없으면 자리표시자(`openai-oauth`)를 사용.
  - 프록시 모드에서는 `response_format: json_object` 를 생략(Codex 백엔드 미지원 가능) → 프롬프트의 JSON 지시 + `parseJson` 으로 처리.
- `routes/autopilot.ts`: `baseUrl` 검증/저장/공개(비밀 아님, 빈 문자열로 공식 API 복귀 가능).
- 프론트엔드(`api.ts`, `AutopilotPage.tsx`): OpenAI Base URL 입력 필드 + 안내 문구.
- 루트 `package.json`: `oauth:login`, `oauth:proxy` 스크립트 추가.

> 주의: openai-oauth 는 비공식 커뮤니티 프로젝트로 OpenAI 와 무관하며, 개인용 로컬 실험 용도로만 사용해야 한다(토큰은 비밀번호급 자격증명). 제공 모델은 Codex 플랜에 따라 달라진다.

**검증**: 서버/웹 타입체크·빌드 통과, 린트 오류 없음.

### 2026-06-22 — Gemini "키는 정상인데 계속 429" 원인 규명 (무료 등급 limit: 0)

**사용 모델**: `gemini-2.0-flash` (DB `autopilot.gemini.model`, 기본값 `GEMINI_MODEL`).

**증상**: python `list_models` 로는 모델 목록이 잘 나오는데(=키는 유효), 앱에서는 계속 429.

**진단**: 실제 `generateContent` 를 직접 호출해 응답 분석.
```
code: 429, status: RESOURCE_EXHAUSTED
Quota exceeded ... free_tier_input_token_count, limit: 0, model: gemini-2.0-flash
Quota exceeded ... free_tier_requests, limit: 0, model: gemini-2.0-flash
quotaId: ...PerMinute-FreeTier / ...PerDay...-FreeTier
retryDelay: 55s
```
- 핵심은 **`limit: 0`**: "많이 써서 소진"이 아니라 **이 키가 속한 Google 프로젝트에 무료 등급이 아예 부여되지 않음**. 한도가 0이라 대기해도 통과 불가.
- `list_models` 는 생성 할당량을 소비하지 않으므로 키가 멀쩡해 보였던 것.

**조치(사용자)**: ① https://aistudio.google.com/apikey 에서 **"새 프로젝트로 API 키 생성"** 으로 무료 등급이 적용되는 새 키 발급, 또는 ② 해당 프로젝트에 **결제(billing) 활성화**로 유료 등급 전환.

**코드 개선** (`server/src/ai.ts`)
- `isFreeTierUnavailable()` 추가: 오류 메시지에 `limit: 0` + `free_tier` 가 동시에 있으면 "무료 등급 미적용"으로 판정.
- 이 경우 전용 한국어 안내 메시지로 표시(새 키 발급/결제 필요)하고, 무의미한 분당 한도 재시도(8초 대기)는 건너뛰도록 수정.

**검증**: 서버 타입체크 통과.

### 2026-06-19 — AI 429(할당량 초과) 오류 처리 개선

**증상**: `모든 AI 호출 실패 → openai: 429 You exceeded your current quota ... | gemini: Gemini 429: ... Quota exceeded ...`

**진단**: 코드 버그가 아니라 **OpenAI·Gemini 두 키 모두 실제 할당량(quota)을 소진**한 상태. 외부 계정 한도이므로 프로그램이 우회할 수 없음.
- OpenAI: 무료 크레딧 만료/소진 → 결제(billing) 등록 필요.
- Gemini: 무료 등급의 분당(RPM)/일일(RPD) 한도 또는 결제 한도 초과.

**개선** (`server/src/ai.ts`)
- Gemini 오류 응답 JSON 을 파싱해 `error.message` 만 깔끔하게 추출하고 HTTP status(429 등)를 오류 객체에 부착.
- 429 중 **"분당 한도(per-minute)" 처럼 일시적인 경우**에는 8초 대기 후 1회 자동 재시도(일일/결제 한도면 다음 제공자로 즉시 폴오버).
- 사용자용 한국어 메시지(`friendlyError`)로 변환: "OpenAI/Gemini 할당량 초과(429). 무료/유료 한도를 모두 소진했거나 결제 설정이 필요합니다." → 상태 패널/로그에 표시.

**조치 안내(사용자)**: OpenAI는 플랫폼에서 결제수단/크레딧 충전, Gemini는 [AI Studio](https://ai.dev/rate-limit) 에서 사용량 확인 후 한도 리셋 대기 또는 결제 활성화. 둘 중 하나라도 여유가 생기면 자동 폴오버로 정상 동작.

**검증**: 서버 타입체크 통과.

### 2026-06-19 — 로그인/세션 확인 버그 수정

**증상**
1. 최초 로그인 시 로그인 창 외에 다른 창이 계속 떴다가 사라짐.
2. 로그인 후 "세션 확인"을 누르면 "로그아웃" 상태로 바뀌고 다시 로그인하라고 표시됨.

**원인**
- 로그인 상태 확인(`isLoggedIn`)이 **2초마다 새 브라우저 페이지(탭)를 열어** 관리자 페이지로 이동 후 닫기를 반복 → 깜빡이는 창의 원인(증상 1).
- 세션 확인을 **헤드리스 브라우저로 실제 페이지를 로드**해서 수행 → 티스토리/카카오 봇 감지에 걸려 로그인 페이지로 리다이렉트되어 로그아웃으로 오판정(증상 2).

**해결**
- `server/src/tistory.ts` 의 `isLoggedIn()` 을 **새 창/페이지를 띄우지 않고 컨텍스트 쿠키를 공유하는 HTTP 요청(`ctx.request.get`)** 으로 로그인 여부를 판정하도록 변경.
  - `maxRedirects: 0` 으로 리다이렉트를 따라가지 않고 응답 상태로 판정 (2xx=로그인, 3xx+로그인 URL=로그아웃).
  - 화면 로드가 없어 깜빡이는 창 제거 + 봇 감지 리다이렉트 회피.

**검증**: 서버 타입체크 통과, 린트 오류 없음.

### 2026-06-19 — README 문서화

- 작업 내용 / 설치 방법 / 사용법 / REST API 명세 / 트러블슈팅 / 한계를 포함하도록 README 전면 보강.

### 2026-06-18 — 초기 구축

- Node + React + TypeScript 모노레포(npm workspaces) 스캐폴딩.
- 백엔드: Express, lowdb, marked/gray-matter, node-cron 스케줄러, Playwright 기반 티스토리 자동화(로그인/세션/발행), REST API.
- 프론트엔드: Vite + React + Tailwind 대시보드(글 목록/에디터/설정, 스케줄러 토글).
- 의존성 설치 및 Chromium 다운로드, 타입체크/빌드/서버 부팅 검증 완료.
