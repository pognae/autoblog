# 티스토리 발행은 Playwright(Chromium) 가 필요하므로, 브라우저와 시스템 의존성이
# 미리 들어 있는 공식 Playwright 이미지를 사용한다. (xvfb 도 포함되어 있어
# 디스플레이가 없는 클라우드 컨테이너에서도 headful 크로미움을 띄울 수 있다.)
# playwright 버전(server/package.json: ^1.49.1)과 태그를 맞춘다.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app

# 1) 워크스페이스 매니페스트만 먼저 복사해 의존성 레이어 캐시 활용
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# 빌드에는 devDependencies(tsc/vite/tsx)가 필요하므로 NODE_ENV=production 으로 설치하지 않는다.
# postinstall 훅이 playwright 버전에 맞는 Chromium 을 내려받는다.
RUN npm install

# 2) 소스 복사 후 server + web 모두 빌드
COPY . .
RUN npm run build

# 런타임 설정
ENV NODE_ENV=production
# xvfb 가 가상 디스플레이를 제공하므로 headful(창 표시) 로 동작시켜 카카오 봇 감지를 회피한다.
ENV PW_HEADLESS=false
# cloudtype 등은 PORT 환경변수를 주입한다. 없으면 3000 사용.
ENV PORT=3000
EXPOSE 3000

# xvfb-run 으로 가상 디스플레이를 띄운 뒤 서버 실행 (서버가 web/dist 도 함께 서빙)
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1366x900x24", "npm", "start"]
