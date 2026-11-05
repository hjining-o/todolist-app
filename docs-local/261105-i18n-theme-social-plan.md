# 다국어·다크 모드·소셜 로그인 설계 및 실행 계획

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-11-05 |
| 작성자 | hjining |
| 범위 | ① 다국어(ko·en·zh·ja) ② 라이트/다크/시스템 테마 ③ Google 소셜 로그인 (Naver는 보류) |
| 선행 계획 | `docs-local/261104-full-stack-plan.md` (기존 Task ID와 겹치지 않도록 `I18N-nn`, `THM-nn`, `SOC-nn` 접두사 사용) |
| 원칙 | 오버 엔지니어링 금지. 이미 있는 것(`next-themes`, `.dark` 토큰, `AppError` 코드, `issueTokens`)을 재사용한다 |

## 0. 결정 사항 (사용자 선택, 2026-11-05)

| 주제 | 선택 | 제외한 대안 |
|------|------|-------------|
| 다국어 | **react-i18next + 브라우저(localStorage) 저장**. 백엔드 에러는 `code`를 프론트에서 번역 | DB(`users.locale`) 저장, 자체 사전+zustand |
| 테마 | **라이트/다크/시스템 3단**, `next-themes`, localStorage 저장, 기본값 `system` | 2단 토글, DB 저장 |
| 소셜 제공자 | **Google만** (2026-11-05 Naver 보류로 변경) | Google + Naver, Naver만 |
| 같은 이메일 처리 | **자동 연결**: 제공자가 확인한 이메일이 기존 계정과 같으면 그 계정에 연결해 로그인 | 거부, 프로필에서 수동 연결 |

### 하지 않는 것
- 백엔드 응답 메시지 다국어화(`Accept-Language`): 프론트가 `code`로 번역하므로 필요 없다
- 언어·테마 서버 동기화, 사용자 입력 데이터(할일 제목 등) 번역, RTL
- 소셜 계정 연결 해제, 소셜 전용 계정의 비밀번호 설정, Naver·Kakao 등 추가 제공자
  - Naver를 다시 넣을 때: `oauth.providers.js`에 항목 하나, CHECK 제약에 값 하나, 버튼 하나를 추가한다. 단, Naver는 `email_verified`를 주지 않으므로 자동 연결 허용 여부를 그때 정한다
- Passport 등 인증 라이브러리 도입: 두 제공자 모두 표준 Authorization Code 흐름이라 `fetch`로 충분하다

## 1. 설계

### 1.1 다국어 (I18N)

- **라이브러리**: `i18next`, `react-i18next`, `i18next-browser-languagedetector`
  - 언어 결정 순서: `localStorage('lang')` → 브라우저 언어 → 기본값 `ko`
  - 지원 언어: `ko`, `en`, `zh`(간체), `ja`. 그 밖의 언어는 `ko`로 대체
- **파일 구조** (네임스페이스는 하나만 둔다)
  ```
  frontend/src/shared/i18n/
    index.ts          # i18next 초기화
    locales/ko.json   # 기준 언어. 키 누락 판정 기준
    locales/en.json
    locales/zh.json
    locales/ja.json
  ```
  - 키는 `기능.항목` 형태로 쓴다. 예: `todo.status.done`, `auth.login.submit`, `error.EMAIL_TAKEN`
  - 번역 파일은 번들에 정적으로 포함한다(4개 언어 합쳐도 작음. 지연 로딩 안 함)
- **적용 대상**
  - 페이지·컴포넌트의 하드코딩 한국어 문자열 → `t('…')`
  - 상수 라벨(`STATUS_LABEL`, `ROLE_LABEL`, `ALL_CATEGORIES` 등) → 라벨 대신 키를 두고 렌더링할 때 `t()`로 바꾼다
  - FullCalendar: `CalendarPage.tsx`의 `koLocale` 고정을 현재 언어의 locale(`ko`, `en`, `zh-cn`, `ja`)로 바꾼다
  - 날짜 표시(`shared/lib/dateTime.ts`): 숫자 형식이면 그대로 둔다. 요일·오전/오후처럼 언어별 텍스트가 있으면 `i18n.language`를 넘긴다
  - `<html lang>`: 언어가 바뀔 때마다 갱신한다(접근성)
- **백엔드 에러 번역**
  - `ApiError.code`가 있으면 `t('error.' + code)`로 표시한다. 키가 없으면 서버 `message`를 그대로 보여 준다
  - `fields`(필드별 검증 메시지)는 서버가 한국어 문장을 보낸다. 언어가 `ko`면 그대로 표시하고, 그 밖의 언어면 `t('error.VALIDATION_FIELD')`("입력값을 확인해 주세요"의 번역)를 표시한다. 어느 필드가 틀렸는지는 키로 알 수 있으므로 기능상 문제는 없다
    - `shortcut: 필드별 상세 사유는 ko에서만 보임, 다국어 사용자가 늘면 백엔드 bad()를 메시지 키로 변경`
  - 이 번역은 공통 지점 한 곳(`ApiError`를 화면에 보여 주는 helper나 `GlobalErrorBanner`)에서만 처리한다
- **언어 선택 UI**: 헤더(`AppLayout`) 우측과 로그인·가입 페이지 우상단에 언어 드롭다운을 둔다(`DropdownMenu` 재사용). 언어명은 각 언어 고유 표기(한국어, English, 中文, 日本語)로 쓴다
- **테스트**: `test/setup.ts`에서 i18n을 `ko`로 초기화한다. 그러면 기존 테스트의 한국어 문자열 단언이 그대로 통과한다. 키 누락 검사 테스트 1개를 추가한다(ko.json 키 집합 = en/zh/ja 키 집합)

### 1.2 테마 (THM)

- `next-themes`의 `ThemeProvider`를 `main.tsx` 최상단에 둔다: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="theme"`
  - `index.css`의 `@custom-variant dark`와 `.dark` 토큰이 이미 있으므로 CSS 변수는 새로 만들지 않는다
  - `sonner.tsx`가 이미 `useTheme`를 쓰고 있어 토스트는 자동으로 따라온다
- 첫 화면 깜빡임(FOUC) 방지: `next-themes`가 head에 넣는 스크립트로 충분하다. `index.html`에 `<meta name="color-scheme" content="light dark">`를 추가한다
- **토글 UI**: 헤더에 아이콘 버튼 + `DropdownMenu`(라이트/다크/시스템, lucide `Sun`·`Moon`·`Monitor`)를 둔다. 모바일 `Sheet` 메뉴에도 같은 컴포넌트를 둔다. 로그인·가입 페이지에는 두지 않는다(시스템 설정을 따름)
- **점검 대상**
  - 하드코딩 색상(`bg-white`, `text-black`, `#hex`): 현재 1곳. 토큰으로 바꾼다
  - 팀 색상(`TEAM_PALETTE`, `MULTI_TEAM_COLOR`)·캘린더 막대·`StatusBadge`가 다크 배경에서 대비 4.5:1을 만족하는지 확인한다. 부족한 색만 `dark:` 변형을 추가한다
  - FullCalendar 기본 CSS(격자선·오늘 강조·더보기 팝오버)를 `--fc-*` CSS 변수로 토큰에 연결한다(`.dark` 블록 안)
- `docs/9-style-guide.md`에 다크 토큰 표와 팀 색상 다크 대비 결과를 추가한다

### 1.3 소셜 로그인 (SOC)

#### 흐름 (백엔드 주도 Authorization Code + state)

```
[로그인 화면] "Google로 계속하기" 클릭
  → 브라우저 이동: GET {API}/api/auth/oauth/google?next=/todos
     백엔드: state(랜덤 32바이트)와 next를 httpOnly 쿠키 oauth_state(10분, path=/api/auth/oauth)에 저장
             → 302 제공자 인가 URL(client_id, redirect_uri, scope, state)
  → 제공자 로그인·동의
  → GET {API}/api/auth/oauth/google/callback?code&state
     백엔드: ① 쿠키 state와 쿼리 state 비교(불일치면 실패)
             ② code → 토큰 교환(fetch, client_secret 사용)
             ③ 프로필 조회 → { providerUserId, email, emailVerified, name }
             ④ 계정 결정(아래 규칙) → issueTokens → setTokenCookies(기존 함수 재사용)
             ⑤ 302 {APP_URL}{next}   실패 시 302 {APP_URL}/login?error=OAUTH_FAILED
```

- `next`는 프론트의 기존 `safeNext`와 같은 규칙(`/`로 시작하고 `//`로 시작하지 않음)으로 백엔드에서 검증한다(오픈 리다이렉트 방지)
- 제공자 설정은 객체 하나에 모은다(`services/oauth.providers.js`). 제공자별로 다른 것은 URL·scope·프로필 파싱뿐이다

| | Google |
|---|---|
| 인가 URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| 토큰 URL | `https://oauth2.googleapis.com/token` |
| 프로필 | `https://openidconnect.googleapis.com/v1/userinfo` |
| scope | `openid email profile` |
| ID·이메일 | `sub`, `email`, `email_verified` |

#### 계정 결정 규칙 (`auth.service.js`의 `oauthLogin`)
1. `user_identities(provider, provider_user_id)`가 있으면 그 사용자로 로그인한다
2. 없고, 이메일이 확인된 상태에서 같은 이메일의 `users`가 있으면 → `user_identities`를 추가하고 그 사용자로 로그인한다(**자동 연결**)
3. 둘 다 없으면 → `users`를 만들고(`password_hash = NULL`), 기본 카테고리를 만들고(`createDefaultCategory`, signup과 같음), `user_identities`를 추가한다
4. 이메일이 없거나 확인되지 않았으면 → 실패(`OAUTH_EMAIL_REQUIRED`)
- 1–3은 `withTransaction` 하나로 처리한다. 동시 가입으로 이메일 unique 충돌이 나면 1회 재시도한다

#### DB 변경 (`003_social_login.sql`)
```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE user_identities (
    provider         text        NOT NULL CHECK (provider IN ('google')),
    provider_user_id text        NOT NULL,
    user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX ix_user_identities_user ON user_identities(user_id);
```

#### 기존 코드 영향
- `login`: `passwordHash`가 NULL이면 bcrypt 비교 없이 `INVALID_CREDENTIALS`로 처리한다(소셜 전용 계정에 비밀번호 로그인 시도. 계정 존재 여부를 노출하지 않음)
- `updateMe` 비밀번호 변경: 해시가 NULL이면 `WRONG_PASSWORD`로 처리한다
- `GET /api/me` 응답에 `hasPassword: boolean`을 추가한다 → 프로필의 `PasswordCard`를 `hasPassword`일 때만 표시한다
- `env.js`: `APP_URL`(프론트 출처, 리다이렉트 대상), `API_URL`(redirect_uri 생성용), `GOOGLE_CLIENT_ID/SECRET`. 제공자 키는 선택값이다. 없으면 해당 제공자 경로가 `NOT_FOUND`를 반환한다(로컬·테스트에서 키 없이 기동 가능)
- `errors.js`: `OAUTH_FAILED`(400), `OAUTH_EMAIL_REQUIRED`(400) 추가
- 쿠키: 콜백은 최상위 GET 이동이라 `SameSite=lax`·`none` 모두 `oauth_state`가 실린다. 토큰 쿠키 발급은 기존 `setTokenCookies`를 그대로 쓴다

#### 프론트
- `LoginPage`·`SignupPage` 폼 아래에 구분선과 "Google로 계속하기" 버튼을 둔다. 버튼은 `<a href={API_BASE + '/api/auth/oauth/google?next=…'}>`이다(fetch가 아니라 페이지 이동)
  - 버튼 디자인은 Google 브랜드 가이드(로고 버튼)를 따른다
- `/login?error=…` 쿼리가 있으면 `t('error.' + code)` 배너를 표시한다
- 로그인 성공 후 돌아오면 기존 `useMe`가 쿠키로 사용자를 불러오므로 추가 상태 관리는 필요 없다

#### 위험
- 제공자 콘솔 등록(Redirect URI: 로컬 `http://localhost:3000/api/auth/oauth/{provider}/callback`, 운영 URL)은 사용자가 직접 해야 한다 → SOC-00

## 2. 실행 계획 (WBS)

> 상태: 빈칸 = 시작 전. 공통 완료 조건: 린트·테스트 통과, `console.log` 없음, Conventional Commits

| 영역 | Task | 이름 | 선행 | 상태 |
|------|------|------|------|------|
| 테마 | THM-01 | ThemeProvider·토글 UI | - | |
| 테마 | THM-02 | 다크 대비 점검·FullCalendar 토큰·스타일 가이드 | THM-01 | |
| 다국어 | I18N-01 | i18n 초기화·언어 선택 UI·테스트 셋업 | - | |
| 다국어 | I18N-02 | 문자열 추출(ko.json)·컴포넌트 치환 | I18N-01 | |
| 다국어 | I18N-03 | 에러 코드 번역·FullCalendar locale·`<html lang>` | I18N-02 | |
| 다국어 | I18N-04 | en·zh·ja 번역·키 누락 테스트 | I18N-02 | |
| 소셜 | SOC-00 | Google 앱 등록, 키 발급 (**사용자 작업**) | - | |
| 소셜 | SOC-01 | 마이그레이션 003·repo | - | |
| 소셜 | SOC-02 | OAuth 라우트·서비스·env·에러 코드 | SOC-01 | |
| 소셜 | SOC-03 | 기존 로그인·비밀번호 변경·`/me` 영향 처리 | SOC-01 | |
| 소셜 | SOC-04 | 프론트 버튼·에러 배너·PasswordCard 조건부 | SOC-02, SOC-03, I18N-01 | |
| 공통 | DOC-01 | 기준 문서 반영(`sync-docs`) | 전체 | |

권장 순서: **THM(가장 작음) → I18N → SOC**. SOC-01–03(백엔드)은 I18N과 병행할 수 있다. SOC-04는 I18N-01 뒤에 해야 새 문자열을 처음부터 `t()`로 쓸 수 있다.

### THM-01 ThemeProvider·토글 UI
- 작업: `main.tsx`에 `ThemeProvider` 추가, `shared/components/ThemeToggle.tsx`(DropdownMenu 3항목) 작성, `AppLayout` 헤더·모바일 Sheet에 배치, `index.html`에 color-scheme 메타 추가
- 완료 조건: 토글로 즉시 전환되고 새로고침해도 유지된다. `system`이면 OS 설정 변경을 따른다. 첫 로드에 깜빡임이 없다
- 테스트: ThemeToggle 선택 시 `document.documentElement`에 `dark` 클래스가 붙는다(1건)

### THM-02 다크 대비 점검
- 작업: 하드코딩 색상 1곳을 토큰으로 교체, 팀 팔레트·상태 배지·캘린더 막대 다크 대비 확인 후 필요한 것만 `dark:` 추가, `.dark`에 `--fc-border-color`, `--fc-today-bg-color`, `--fc-page-bg-color` 등 매핑, `docs/9-style-guide.md` 갱신
- 완료 조건: 목록·편집·캘린더(월·주·일)·팀·프로필·다이얼로그를 다크로 육안 확인(스크린샷). 본문 텍스트 대비 4.5:1 이상

### I18N-01 i18n 초기화
- 작업: 의존성 3개 설치, `shared/i18n/index.ts`(detector: localStorage `lang` → navigator, fallback `ko`, `supportedLngs`), `main.tsx`에서 import, `LanguageSelect` 컴포넌트(헤더·로그인·가입 페이지), `test/setup.ts`에서 `ko` 고정
- 완료 조건: 언어 변경이 즉시 반영되고 새로고침해도 유지된다. 기존 테스트가 모두 통과한다

### I18N-02 문자열 추출·치환
- 작업: `frontend/src` 하드코딩 한국어(테스트 제외)를 `ko.json`으로 옮기고 `t()`로 치환한다. 상수 라벨 맵은 키 맵으로 바꾼다. 기능 폴더 단위로 커밋한다(auth → todos → categories → teams → users → pages·app)
- 완료 조건: `grep -rP "[가-힣]" frontend/src --include=*.tsx --include=*.ts`(테스트·locales 제외) 결과가 주석 외에 0건. 기존 테스트가 통과한다(ko 고정이라 문자열 단언 변경 없음)

### I18N-03 에러·캘린더·lang
- 작업: `ApiError` 표시 helper에 `error.{code}` 번역 + fallback 적용, `fields`는 1.1 규칙대로 처리, `CalendarPage` locale 동적화, `languageChanged` 이벤트로 `document.documentElement.lang` 갱신
- 완료 조건: en으로 바꾼 뒤 잘못된 비밀번호로 로그인하면 영어 에러가 나온다. 캘린더 요일·버튼이 언어를 따른다
- 테스트: 에러 번역 helper(코드 있음/없음/fields) 1건

### I18N-04 번역
- 작업: `ko.json`을 기준으로 `en`·`zh`·`ja` 작성(초안은 Claude가 작성하고, 원어민 검수 여부는 사용자가 결정). 문장 길이가 길어지는 en에서 버튼·헤더·필터바가 넘치지 않는지 모바일 폭으로 확인
- 완료 조건: 키 누락 테스트 통과(4개 언어 키 집합 동일), 4개 언어 화면 육안 확인

### SOC-00 앱 등록 (사용자 작업)
- Google Cloud Console: OAuth 클라이언트(웹), 승인된 리디렉션 URI 등록
- `backend/.env`에 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`, `APP_URL`, `API_URL` 추가. 운영(Vercel) 환경변수에도 등록

### SOC-01 마이그레이션·repo
- 작업: `backend/src/db/migrations/003_social_login.sql`(1.3 DDL), `repositories/identities.repo.js`(`findUserByIdentity`, `insertIdentity`), `users.repo`의 생성 함수가 `passwordHash` NULL을 허용하는지 확인
- 완료 조건: `npm run db:migrate` 적용, 테스트 DB 리셋 스크립트 통과
- 메모: 운영 DB 적용 전에 사용자에게 확인을 받는다

### SOC-02 OAuth 라우트·서비스
- 작업: `services/oauth.providers.js`(제공자 설정·`exchangeCode`·`fetchProfile`), `auth.service.js`에 `oauthLogin`(1.3 계정 결정 규칙), `routes/auth.routes.js`에 `GET /oauth/:provider`, `GET /oauth/:provider/callback`, `env.js`·`errors.js` 갱신, `docs/8-swagger.yaml`에 두 경로 추가
- 완료 조건: 로컬에서 Google 신규 가입, 재로그인, 기존 이메일 계정 자동 연결 성공
- 테스트(supertest, 제공자 `fetch`는 mock): state 불일치 거부, `next` 오픈 리다이렉트 거부, 규칙 1·2·3·4 각 1건, 미설정 제공자 404

### SOC-03 기존 기능 영향
- 작업: `login` NULL 해시 처리, `updateMe` NULL 해시 처리, `getMe`·`toMe`에 `hasPassword`, swagger `Me` 스키마 갱신
- 테스트: 소셜 전용 계정의 비밀번호 로그인 → 401 `INVALID_CREDENTIALS`, 비밀번호 변경 → 400 `WRONG_PASSWORD`

### SOC-04 프론트
- 작업: `features/auth/components/SocialLoginButtons.tsx`, Login·Signup 페이지에 배치, `?error=` 배너, `ProfilePage`에서 `hasPassword`가 false면 PasswordCard 숨김, `Me` 타입에 `hasPassword` 추가, 문자열은 처음부터 `t()`로 작성
- 완료 조건: 버튼 → 제공자 → 원래 가려던 페이지로 복귀. 실패 시 로그인 화면에 에러 배너 표시
- 테스트: 버튼 href에 `next`가 인코딩되어 들어간다, `?error=OAUTH_FAILED` 배너 표시(각 1건)

### DOC-01 기준 문서 반영
- `sync-docs`로 PRD(기능 요구사항), 사용자 시나리오(소셜 로그인·언어·테마), 와이어프레임(헤더 토글·로그인 버튼), ERD(`user_identities`, `password_hash` nullable), swagger, 스타일 가이드를 갱신한다

## 3. 확인 필요 사항

| ID | 내용 | 기본안 |
|----|------|--------|
| X-02 | 번역 품질 검수 주체 | Claude 초안으로 출시, 피드백 반영 |
| X-03 | 운영 도메인 확정 전 Redirect URI | 로컬만 등록해 개발하고, 배포(CM-05) 때 운영 URI 추가 |
