# TodoList 프로젝트 구조 설계 원칙

| 항목 | 내용 |
|------|------|
| 문서 버전 | v0.17 |
| 상태 | 초안 |
| 최종 수정일 | 2026-11-06 |
| 작성자 | hjining |
| 기준 문서 | `docs/1-domain-definition.md` v0.15, `docs/2-prd.md` v0.17, `docs/3-user-scenario.md` v0.16, `docs/4-wireframe.md` v0.15 |

> 표기
> - 근거는 기준 문서의 ID와 절로 쓴다. 도메인 규칙 `R`·`S`·`F`·`UC`, 도메인 절 `도메인 §n`, PRD 절 `PRD §n`과 PRD ID(`SC`, `A`, `B`, `K`, `M`, `Q1`–`Q4`), 시나리오 `US-xx`·`EX-xx`·`C-xx`·`D-xx`(시나리오 6장은 `시나리오 §6`), 와이어프레임 `ST-xx`·`DLG-xx`·`U-xx`.
> - 원칙 ID: `P-xx`(1장), `BE-xx`(백엔드 의존), `FE-xx`(프론트 의존), `N-xx`(네이밍), `Q-xx`(품질), `SEC-xx`(보안·입력), `OPS-xx`(설정·운영). 도메인의 문제 `P1`–`P5`, 우선순위 `P0`/`P1`, PRD의 미결 결정 `Q1`–`Q4`와는 하이픈으로 구분한다.
> - **[가정]** = 기준 문서에 없어 이 문서에서 정한 사항. 7장에서 상태(확정, 미결)를 관리한다. 미결 항목은 구현 전에 정한다.
> - 변경 이력은 8장에 있다.

## 1. 모든 스택에 공통인 최상위 원칙

### 1.1 공통 원칙

| ID | 원칙 | 근거 |
|----|------|------|
| P-01 | 코드 이름은 도메인 용어를 따른다. 엔티티(User, Category, Todo, TodoShare, Team, TeamMember, TodoHistory)와 역할·상태 용어를 그대로 쓰고, 동의어(task, group, log 등)를 만들지 않는다. | 도메인 §2, §3 |
| P-02 | 권한, 입력 검증, 상태 계산, '오늘' 판정은 서버가 최종 판정한다. 클라이언트 검증과 버튼 숨김은 편의 기능이며 보안 수단이 아니다. | PRD §5.2, §5.3, 시나리오 EX-07, EX-20 |
| P-03 | 규칙은 한 곳에만 구현한다. 권한 조건(R2, R19, R21)은 `access.js` 한 파일, 상태 판정(S1–S4)은 `todo-status.js` 한 함수, 일시 정규화(R3–R5)는 `period.js` 한 모듈에만 둔다. 같은 규칙을 다른 곳에 복사하지 않는다. | PRD §4.2, §9 K4, K5 |
| P-04 | 파생값은 저장하지 않는다. `status`는 조회 시 계산해 응답에만 넣고, DB 컬럼이나 요청 필드로 받지 않는다. 저장하는 값은 `completed`, `startAt`, `endAt`(및 `completedAt`)뿐이다. | 도메인 §5.1 |
| P-05 | 기본 거부. 미인증은 401, 볼 수 없는 리소스(공유 없음, 비구성원)는 404로 존재를 숨긴다, 볼 수는 있으나 변경 권한이 없으면 403. 허용은 명시적으로만 한다. | PRD §5.2, 도메인 R1, R2, 시나리오 EX-05, EX-20, EX-21 |
| P-06 | 비밀과 내부 정보는 응답, 로그, 클라이언트 번들에 나가지 않는다. 대상은 비밀번호, 해시, JWT, 시크릿, 스택 트레이스, 다른 사용자의 카테고리 정보다. | PRD §5.2, 시나리오 §6.2 (500) |
| P-07 | 범위 밖 기능의 코드, 테이블, 라우트, 화면을 만들지 않는다. 대상은 휴지통, 알림, 반복 할일, 우선순위, 태그, Google 외 소셜 로그인(Naver 등), 소셜 계정 연결 해제, 소셜 전용 계정의 비밀번호 설정, 비밀번호 찾기, 회원 탈퇴, 팀 삭제, 초대 수락, 실시간 동기화, 서버 응답 메시지의 다국어화, 언어·테마의 서버 저장, 사용자 입력 데이터 번역, RTL이다. | 도메인 §7, PRD §3.2 |
| P-08 | 데이터 모델은 P1 테이블(TodoHistory 포함)까지 Day 1에 한 번에 만든다. P1 기능의 라우트와 화면은 P1 구현 때 추가한다. | PRD §4.2 A6 |
| P-09 | 작게 만든다. 1인 2일 MVP 기준으로, 문서에 없는 추상화 계층, 공통 프레임워크, 설정 옵션을 만들지 않는다. 필요가 생기면 이 문서를 먼저 고친다. | PRD §2.1, K1, K2 |

### 1.2 적용 스택 (문서 근거)

| 영역 | 스택 | 근거 |
|------|------|------|
| 프론트엔드 | React 19 + TypeScript, TanStack Query(서버 상태), Zustand(UI 상태), 브라우저 기본 `<input type="date">`, `<input type="time">` | PRD §6 |
| 프론트 빌드 | Vite | PRD §6, §8.1 |
| UI 컴포넌트 | shadcn/ui (Tailwind CSS + Radix UI, `lucide-react`). 날짜 입력은 shadcn `Input`으로 스타일만 맞춘 기본 input이며 shadcn Date Picker는 쓰지 않는다 | PRD §6, A24 |
| 캘린더 | FullCalendar(`@fullcalendar/react`, `daygrid`, `timegrid`). PRD §6이 허용한 오픈소스 라이브러리 중에서 고른 것이다. `dayMaxEvents: 3`으로 한 칸 3개 + `+N`, `moreLinkClick`에서 일 뷰(`timeGridDay`)로 바꿔 `+N`을 누르면 일 뷰(U-13. 문자열 `'day'`는 `dayGridDay`로 가므로 쓰지 않는다), `firstDay: 0`으로 일요일 시작(C-07), `defaultTimedEventDuration: '00:01'`로 시작 = 종료 할일이 다음 날 칸으로 넘어가지 않게 한다(R3, R15). shadcn Calendar로 대신하지 않는다 | PRD §6, §9 K8, [가정 G-11] |
| 다국어 | `i18next`, `react-i18next`, `i18next-browser-languagedetector`. 번역 파일 4개(`ko`, `en`, `zh`, `ja`)는 `shared/i18n/locales/`에 두고 번들에 정적으로 포함한다. 언어 결정 순서는 localStorage `lang` → 브라우저 언어 → `ko`이고 지원 언어 밖은 `ko`다. 네임스페이스는 하나만 둔다 | PRD §6, A30 |
| 테마 | `next-themes`(`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="theme"`)를 `main.tsx` 최상단에 둔다. 기존 `index.css`의 `.dark` 토큰과 `@custom-variant dark`를 쓰고 `index.html`에 `<meta name="color-scheme" content="light dark">`를 둔다 | PRD §6, A31 |
| 소셜 로그인 | 별도 인증 라이브러리 없이 Node `fetch`로 Google OAuth 2.0 Authorization Code 흐름을 처리한다. 제공자 설정은 `services/oauth.providers.js` 객체 하나에 모은다 | PRD §5.2, A32, A34 |
| 백엔드 | Node.js + JavaScript(TypeScript 아님) + Express | PRD §6 |
| DB 접근 | `pg`(node-postgres). Prisma와 다른 ORM 금지 | PRD §6 |
| 데이터베이스 | PostgreSQL 17, Supabase 사용. DB로만 쓰며 Supabase Auth와 자동 생성 API는 쓰지 않음 | PRD §5.1 B1 |
| 배포 | Vercel. 프론트 정적 빌드와 Express(Vercel Functions)를 배포하고, 프론트는 `VITE_API_BASE_URL`의 API 출처로 `/api/*`를 직접 호출한다(CORS, SEC-07). 프로젝트 구성은 실행 계획 W-09 | PRD §5.1 |
| 인증 | 액세스 토큰은 `HS384` JWT(쿠키 `access_token`, 15분), 리프레시 토큰은 불투명 문자열(쿠키 `refresh_token`, 7일, DB에 해시). `jsonwebtoken`, `cookie-parser`, Node `crypto`. 비밀번호는 `bcryptjs`, cost 10 | PRD §5.2 B4, A25, A26, [가정 G-09] |
| 테스트 | Vitest(단위, 통합), supertest(API 통합), `@playwright/test`(E2E 회귀), Playwright MCP(E2E 탐색과 스크립트 작성 보조) | [가정 G-04] |
| API 문서 화면 | `swagger-ui-express` + `js-yaml`(백엔드 개발 의존성). 개발 모드(`npm run dev`)에서만 Swagger UI를 `/swagger`에 붙인다. 명세 원본은 `docs/8-swagger.yaml` 하나이고, 화면에는 문자열 `description`을 뺀 명세를 보낸다(설명문은 문서에만 둔다). 배포 진입점(`api/index.js` → `app.js`)에는 없다 | `docs/8-swagger.yaml` |

## 2. 의존성 및 레이어 원칙

### 2.1 백엔드 레이어

의존 방향은 `routes → services → repositories → (config/db)`이다. `domain`은 아무것도 import하지 않는다.

| 레이어 | 책임 | 허용 import |
|--------|------|-------------|
| routes | 경로·메서드 정의, 요청 파싱, 형식·길이 검증, 서비스 호출, 응답 조립 | services, middleware, domain/errors |
| middleware | CORS·Origin 검사, 인증(쿠키 JWT → `req.user`), 공통 에러 응답 변환 | config/env, domain/errors |
| services | 유스케이스, 도메인 규칙 적용, 권한 판정 호출, 트랜잭션 경계 | domain, 같은 모듈 repositories, 다른 모듈 services |
| domain | 순수 함수(상태 판정, 기간 정규화, 이력 diff), `AppError`와 에러 코드 상수 | 없음 |
| repositories | SQL 실행, row를 camelCase 객체로 변환, 권한 조각 사용 | config/db, repositories/sql |
| config | 환경변수 검증, `pg.Pool` 생성, `withTransaction` 헬퍼 | 없음 |

백엔드 금지 규칙:

| ID | 규칙 |
|----|------|
| BE-01 | routes는 repositories와 `pg`를 import하지 않는다. 데이터는 services를 거친다. |
| BE-02 | services는 `req`, `res` 같은 Express 객체와 HTTP 상태 코드를 다루지 않는다. 실패는 `AppError`로 던진다. |
| BE-03 | domain은 express, pg, config, services, repositories를 import하지 않는다. |
| BE-04 | `pg`는 `config/db.js`와 `repositories/`에서만 import한다. |
| BE-05 | repositories는 services와 routes를 import하지 않는다. 할일과 카테고리의 권한 WHERE 조건은 `repositories/sql/access.js`의 조각으로만 쓴다. |
| BE-06 | 다른 모듈의 데이터는 그 모듈의 service 함수로만 접근한다. 예: `todos`가 카테고리를 확인할 때는 `categories.service`를 호출하고 `categories.repo`를 직접 호출하지 않는다. |
| BE-07 | SQL은 `$1, $2 …` parameterized query만 쓴다. 문자열 연결이나 템플릿 리터럴로 SQL을 만들지 않는다. 정렬 컬럼 같은 식별자는 허용 목록 객체에서만 고른다. |
| BE-08 | 여러 쓰기를 한 단위로 묶어야 하는 흐름(가입, 카테고리 삭제와 할일 이동, 구성원 제거와 공유 해제, 팀 나가기, 리프레시 토큰 회전, P1의 할일 변경과 이력 기록)은 service에서 `withTransaction`으로 감싼다. repository 함수는 `client`(pool 또는 트랜잭션 클라이언트)를 인자로 받는다. |
| BE-09 | 순환 import를 만들지 않는다. |

### 2.2 프론트엔드 레이어

의존 방향은 `app → pages → features → shared`이고, `stores`는 UI 상태만 담으며 아무것도 import하지 않는다.

| 레이어 | 책임 | 허용 import |
|--------|------|-------------|
| app | 라우트 정의(SC-01–SC-09), 인증 가드(ST-01), 공통 레이아웃(SC-00) | pages, features, shared, stores |
| pages | 화면 1개 = 파일 1개. features의 훅과 컴포넌트를 조합하고 라우트 파라미터를 읽는다 | features, shared, stores |
| features/<도메인> | 서버 상태 훅(TanStack Query), 도메인 컴포넌트, 표시 로직 | shared, stores |
| shared | 도메인 무관한 API 클라이언트, UI 부품, 순수 유틸, 공통 타입 | 없음 |
| stores | Zustand UI 상태(필터, 캘린더 뷰와 기준일, 모달 열림 등) | 없음 |

프론트엔드 금지 규칙:

| ID | 규칙 |
|----|------|
| FE-01 | pages 간에 import하지 않는다. 공통 코드는 features 또는 shared로 내린다. |
| FE-02 | features는 pages와 app을 import하지 않는다. |
| FE-03 | shared는 features, pages, stores를 import하지 않는다. |
| FE-04 | HTTP 호출은 `shared/api/client.ts`를 거친다. 컴포넌트와 페이지에서 `fetch`를 직접 호출하지 않는다. 서버 데이터 훅은 `features/<도메인>/`에 둔다. |
| FE-05 | 서버 응답 데이터(할일, 카테고리, 팀 등)를 Zustand에 복사하지 않는다. Zustand에는 서버와 무관한 UI 상태만 둔다(PRD §6). |
| FE-06 | 상태(S1–S4) 판정, '오늘', 시간대 계산에 클라이언트 시계(`new Date()`)를 쓰지 않는다. 상태는 서버 응답의 `status`를 표시하고, 일시는 `User.timezone` 기준으로 포맷만 한다(PRD §5.3, 와이어프레임 §3.3). 예외: 캘린더의 '오늘' 이동, 초기 기준일, 오늘 칸 강조(FR-08 #1)는 브라우저 시계를 써도 된다. 화면 이동에만 쓰고 상태나 저장 값에는 쓰지 않는다. |
| FE-10 | 캘린더에 넘기는 일시는 서버가 `User.timezone`의 오프셋으로 보낸 ISO 8601 문자열에서 오프셋을 뗀 벽시계 값(`2026-11-04T09:00`)이다. FullCalendar는 `timeZone: 'UTC'`로 설정해 다시 변환하지 않는다. 그래서 브라우저 시간대와 `User.timezone`이 달라도(US-16 #5) 사용자 시간대로 보이고, 시간대 플러그인은 두지 않는다. 변환 함수는 `features/todos/calendar/` 한 곳에 둔다. |
| FE-07 | 편집, 완료, 삭제 버튼 노출과 카테고리 필드 활성 여부는 서버 응답의 권한 플래그(`canEdit`, `isOwner`, [가정 G-06])로만 결정한다. |
| FE-08 | 버튼, 입력, 선택, 표, 배지, 대화상자 같은 기본 UI 부품은 `shared/components/ui/`의 shadcn 컴포넌트를 쓴다. 같은 부품을 직접 만들거나 다른 UI 라이브러리를 추가하지 않는다. 컴포넌트 추가는 shadcn CLI 또는 shadcn MCP로만 한다(PRD §6). |
| FE-11 | 화면에 보이는 문구는 하드코딩하지 않고 `t('기능.항목')`으로 쓴다(예: `todo.status.done`, `auth.login.submit`, `error.EMAIL_TAKEN`). 상수 라벨 맵은 라벨 대신 키를 두고 렌더링할 때 `t()`로 바꾼다. 컴포넌트 밖(`client.ts`, 쿼리 클라이언트, 캘린더 툴팁)은 `i18n.t`를 쓴다. `ko.json`이 기준이고 새 키는 4개 번역 파일 모두에 넣는다(키 집합과 보간 변수 일치는 `locales.test.ts`가 확인한다). `ApiError`의 표시 번역은 `shared/api/errorMessage.ts` 한 곳에서만 한다. 언어가 바뀌면 `<html lang>`을 갱신한다(근거 PRD FR-13, A30). 사용자 입력 데이터는 번역하지 않되, 서버가 만든 기본 카테고리 이름 '기본'은 화면에 쓸 때마다 `features/categories/categoryName.ts`의 `categoryName(name)`을 거쳐 `category.default`로 번역한다(이름으로 판별: 이름은 소유자별 유일하고 기본 카테고리는 이름 변경 불가이며 할일·이력의 카테고리 ref에 `isDefault`가 없다. PRD FR-13 #5). 예외: 개발자용 로그 메시지(`logger`, OPS-25)는 한국어 문자열이고 `t()`를 쓰지 않는다. |
| FE-12 | 테마는 `next-themes`가 `<html>`에 붙이는 `dark` 클래스와 `index.css`의 토큰으로만 구현한다. 컴포넌트에서 `isDark` 분기를 만들지 않고, 필요하면 `dark:` 변형이나 CSS 변수를 쓴다(근거 PRD FR-14, A31, 스타일 가이드 7.3). |
| FE-09 | `shared/components/ui/`의 생성 파일은 직접 고치지 않는 것을 기본으로 한다. 도메인 표현(예: 상태 배지 색)은 features 컴포넌트에서 감싸서 만든다. 스타일은 Tailwind 유틸리티 클래스와 `src/index.css`의 테마 변수로만 지정하고, 별도 CSS 파일과 인라인 `style`은 캘린더 라이브러리 덮어쓰기 외에는 쓰지 않는다. 예외: 팀 캘린더 팔레트와 여러 팀 전용 색은 사용자가 고르는 데이터 색이라 `style`의 색 지정을 허용한다(스타일 가이드 1장·7.1, PRD A29). |

## 3. 코드 및 네이밍 원칙

| ID | 대상 | 규칙 | 예시 | 근거 |
|----|------|------|------|------|
| N-01 | 디렉토리 | 소문자 kebab-case. 도메인 모듈 이름은 엔티티의 복수형이다. 독립 경로가 없는 엔티티(TodoShare, TeamMember)는 상위 모듈에 둔다. | `features/todos/`, `features/todo-histories/`, `services/teams.service.js` | 도메인 §3, [가정 G-01] |
| N-02 | 프론트 컴포넌트 파일 | PascalCase.tsx. 화면 파일은 `<이름>Page.tsx`이고, 첫 줄 주석에 화면 ID를 적는다. 예외: `shared/components/ui/`는 shadcn이 만든 kebab-case 이름(`alert-dialog.tsx`)을 그대로 둔다. | `TodoListPage.tsx` (`// SC-03`) | 와이어프레임 §2.1, PRD §6 |
| N-03 | 프론트 훅과 유틸 파일 | camelCase.ts. 훅은 `use` 접두사를 붙인다. | `useTodos.ts`, `dateTime.ts` | [가정 G-05] |
| N-04 | 백엔드 파일 | kebab-case. 계층 파일은 `<모듈>.<계층>.js`(routes, service, repo)로 쓴다. domain, middleware, config 파일은 역할 접미사 없이 쓴다. | `todos.routes.js`, `todos.service.js`, `todos.repo.js`, `todo-status.js`, `error-handler.js` | [가정 G-01] |
| N-05 | 테스트 파일 | `<대상>.test.js`(백엔드) 또는 `<대상>.test.ts(x)`(프론트, 대상 파일 옆). E2E는 `e2e/<기능>.spec.ts`이고, 테스트 제목 앞에 시나리오 ID를 붙인다. | `todo-status.test.js`, `e2e/todos.spec.ts`의 `'US-04 할일 등록'` | [가정 G-04] |
| N-06 | 변수, 함수 | camelCase. 도메인 속성명을 그대로 쓴다. | `ownerId`, `startAt`, `endAt`, `completedAt`, `categoryId`, `teamId` | 도메인 §3 |
| N-07 | 불리언 | `is`, `has`, `can` 접두사를 쓴다. 도메인 속성은 원래 이름을 유지한다. | `canEdit`, `isOwner`, `isDefault`, `completed` | 도메인 §3.5, 와이어프레임 §4.5 |
| N-08 | 동의어 금지 | 할일은 `todo`(task, item 금지), 카테고리는 `category`(group, tag 금지), 팀은 `team`(group, workspace 금지), 이력은 `history`(audit 금지). `log`는 로깅 전용이다(`logger`, OPS-25). | — | 도메인 §2 |
| N-09 | 상수, enum 값 | UPPER_SNAKE_CASE. 역할 `OWNER`, `MANAGER`, `MEMBER`와 이력 동작 `CREATED`, `UPDATED`, `COMPLETED`, `UNCOMPLETED`는 도메인 값을 그대로 쓴다. 상태 값은 `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`로 쓴다. | `TodoStatus.OVERDUE` | 도메인 §3.3, §3.8, [가정 G-06] |
| N-10 | 컴포넌트 이름 | PascalCase 명사. 화면 요소는 도메인 이름을 쓴다. shadcn 컴포넌트 이름(`Button`, `AlertDialog`)과 겹치는 이름을 만들지 않는다. | `TodoRow`, `StatusBadge`, `CategorySelect`, `TeamMemberTable`, `ConfirmDialog` | 와이어프레임 §2.1 |
| N-11 | API 경로 | `/api/` 아래 소문자 kebab-case 복수형 명사. 중첩은 최대 2단계. 동작은 HTTP 메서드로 나타낸다. 동사 경로는 로그인처럼 메서드로 나타낼 수 없는 동작에만 쓴다. 소셜 로그인은 브라우저가 이동하는 경로라 `GET /api/auth/oauth/:provider`(시작)와 `GET /api/auth/oauth/:provider/callback`(제공자가 돌려보내는 곳)을 쓰고 응답은 JSON이 아니라 302다(SEC-13). 소유자가 팀을 나가는 일은 `POST /api/teams/:teamId/leave`로만 처리하고, 구성원 제거 경로에 자기 자신을 지정하면 400 `VALIDATION_ERROR`다. 예외: 로그인한 사용자 자신의 정보는 `/api/me`로 쓴다(ID를 경로에 받지 않아 다른 사용자 접근 경로가 생기지 않는다). | `GET`, `POST /api/todos`; `PATCH`, `DELETE /api/todos/:todoId`; `GET /api/todos/:todoId/histories`; `POST /api/teams/:teamId/members`; `POST /api/teams/:teamId/leave`; `GET /api/todos?from=&to=`(캘린더 조회. 목록 API에 기간 필터를 더한 것이며 별도 경로를 만들지 않는다); `GET /api/teams/:teamId/members`(구성원 목록. F4 사용자 선택지도 이 경로를 재사용한다); `GET`, `POST /api/categories`; `PATCH`, `DELETE /api/categories/:categoryId`; `DELETE /api/teams/:teamId/members/:userId`(구성원 제거); `PATCH /api/teams/:teamId/members/:userId`(역할 변경); `GET /api/teams`(내가 속한 팀 목록과 내 역할. SC-08, SC-09의 팀 이름·내 역할도 이 결과를 쓴다); `POST /api/teams`(팀 생성. 생성자가 OWNER, DLG-03); `PATCH /api/teams/:teamId/color`(캘린더 팀 색. 요청자 본인 `team_members` 행의 색만 바꾼다, 역할 무관, 계획서 6.3 CL-02). 팀 단건 조회·이름 변경·삭제 경로는 두지 않는다(요구사항 없음, 팀 삭제는 도메인 7장 범위 밖) | PRD §5.1, [가정 G-06] |
| N-12 | 완료 처리 | 별도 경로를 만들지 않는다. `PATCH /api/todos/:todoId`의 `completed` 필드로 처리하고, `completedAt`은 서버가 설정한다. 이력은 요청 1건에 1건이다. 완료 여부가 바뀐 요청은 `COMPLETED`/`UNCOMPLETED`, 그 밖은 `UPDATED`이고 함께 바뀐 필드도 모두 `changes`에 담는다. | — | 도메인 R14, R20, §3.6, §3.8 |
| N-13 | HTTP 메서드 | `GET`은 상태를 바꾸지 않는다. 상태 변경은 `POST`, `PATCH`, `DELETE`만 쓴다. 예외는 소셜 로그인 콜백 하나다(SEC-07). | — | PRD §5.2 CSRF |
| N-14 | JSON 필드, 쿼리 파라미터 | camelCase. 일시는 ISO 8601 + 오프셋 형식이다(요청에서 날짜만 보낸 값은 SEC-11 예외). 목록 파라미터는 `limit`, `offset`을 쓴다. | `startAt: "2026-11-04T09:00+09:00"` | PRD §5.1, §5.3 |
| N-15 | 권한 플래그 | 할일 응답에 `canEdit`(수정·완료·삭제 가능), `isOwner`(소유자 본인 여부)를 넣는다. 다른 사용자 할일의 응답에는 카테고리 필드를 넣지 않는다. | — | 와이어프레임 §4.5.2, PRD §5.2 [가정 G-06] |
| N-16 | 에러 코드 | UPPER_SNAKE_CASE. 시나리오 §6.2 표의 코드만 쓴다. 새 코드는 §6.2에 먼저 추가한다. 코드를 더하면 프론트 4개 번역 파일의 `error.<코드>`도 함께 추가한다(FE-11). | `INVALID_PERIOD`, `FORBIDDEN` | 시나리오 §6.2 |
| N-17 | DB 테이블 | snake_case 복수형. | `users`, `user_identities`, `categories`, `todos`, `todo_shares`, `teams`, `team_members`, `todo_histories` | [가정 G-07] |
| N-18 | DB 컬럼 | snake_case. 기본키는 `id`, 참조는 `<엔티티>_id`, 시각은 `*_at`, 기본 카테고리는 `is_default`. 비밀번호 해시는 `password_hash`다. `status` 컬럼은 만들지 않는다(P-04). | `owner_id`, `start_at`, `end_at`, `completed_at`, `is_default`, `password_hash` | [가정 G-07] |
| N-19 | DB 제약, 인덱스 | `uq_<테이블>_<컬럼>`, `idx_<테이블>_<컬럼>`. 컬럼이 여럿이면 `_`로 잇는다. 대소문자 무시 유일은 `lower(...)` 표현식 인덱스로 만들고 `_lower`를 붙인다. 단, 이메일은 소문자로만 저장하므로(`CHECK (email = lower(email))`) 일반 유일 제약이다. PK·FK·CHECK는 이름을 붙이지 않는다(ERD E-09, E-10). 예외로 소셜 계정 연결의 사용자 인덱스는 구현된 이름 `ix_user_identities_user`를 그대로 쓴다(ERD E-16). | `uq_users_email`, `uq_teams_name_lower`, `idx_todos_category_id` | PRD §5.1 인덱스 수준, [가정 G-07] |
| N-20 | 이름 변환 | snake_case와 camelCase 변환은 repositories에서만 한다. API와 프론트는 camelCase만 쓴다. | — | [가정 G-07] |

## 4. 테스트 및 품질 원칙

### 4.1 테스트 종류, 위치, 최소 기준

| ID | 종류 | 대상 | 위치 | 최소 기준 |
|----|------|------|------|-----------|
| Q-01 | 단위(백엔드) | `domain/` 규칙 | `backend/tests/unit/` | S1–S4 판정 순서. R3 경계(같은 일시 허용). R4 세 경우의 기본값. R5 분 단위 경계(11/05 23:59:30은 진행 중, 11/06 00:00은 기한 초과, 시작 정각은 진행 중). 근거: 시나리오 EX-07, EX-08, EX-10, EX-11, EX-14 |
| Q-02 | 통합(백엔드) | services, repositories와 PostgreSQL 17 | `backend/tests/integration/` | 권한: 비구성원 404(EX-21), 일반 팀원의 변경 403(EX-20), 관리자의 구성원 할일 수정 성공(US-14), 관리자라도 공유되지 않은 할일은 404(EX-25). 타인 할일 응답에 카테고리 없음(R2). 가입 트랜잭션 원자성(EX-01). 리프레시 토큰 회전·재사용 감지·로그아웃 후 갱신 401(EX-42, EX-43, SEC-02), `HS384` 외 알고리즘 토큰 거부(SEC-03). 카테고리 삭제 시 할일 이동 원자성(R9). 구성원 제거 시 공유 해제(R21). P1: 할일 변경과 이력이 같은 트랜잭션(EX-33). |
| Q-03 | 프론트 단위 | 날짜와 시간대 포맷, 필터를 쿼리 파라미터로 바꾸는 함수, 권한 플래그 분기 | `frontend/src/**/` (대상 옆) | 분기가 있는 함수는 분기마다 케이스 1개 이상 |
| Q-04 | 프론트 컴포넌트 | 권한별 화면 | 대상 옆 `*.test.tsx` | SC-03(행의 완료, 삭제 버튼 노출)과 SC-04(읽기 전용 모드)만. 나머지 화면은 수동 검증. Radix 컴포넌트용 jsdom 보완(`ResizeObserver`, `hasPointerCapture`, `scrollIntoView`)은 `src/test/setup.ts` 한 곳에 둔다. shadcn 생성 컴포넌트 자체는 테스트하지 않는다 |
| Q-05 | E2E (`@playwright/test`) | P0 시나리오(US)의 정상 흐름과 권한 예외(EX-20, EX-21) | 루트 `e2e/` | P0 US 1개당 테스트 1개 이상(수동 검증하는 US-10 모바일 레이아웃 제외). 스크립트를 실행해 통과하면 PRD 4.3 체크박스에 표시한다. Day 2 종료 시 P0 100%(M6). Playwright MCP는 시나리오를 브라우저에서 먼저 따라가 보고 스크립트를 작성, 디버깅하는 데 쓴다. 모바일 레이아웃처럼 스크립트로 확인하기 어려운 항목은 수동으로 검증한다 [가정 G-04] |
| Q-06 | 부하 테스트 | — | — | 하지 않는다(PRD Q2) |

### 4.2 커버리지 기준

- Q-07 라인, 분기 커버리지 수치 목표는 두지 않는다 [가정 G-12]. 1인 2일 일정에서 수치 목표는 테스트 대상을 왜곡한다.
- Q-08 대신 **규칙 추적**을 기준으로 한다. 권한(R2, R19, R21), 상태(S1–S4, 도메인 §5.3), 일시(R3–R5), 트랜잭션(R9, R20, EX-01)에 해당하는 규칙은 각각 자동 테스트가 1개 이상 있어야 머지한다(PRD K2, K4, K5).
- Q-09 새 분기, 루프, 권한 조건을 추가하면 테스트 1개를 같이 추가한다. 단순 CRUD 연결과 스타일 변경은 제외한다.

### 4.2.1 E2E 원칙 (`@playwright/test`, Playwright MCP)

- Q-17 E2E는 운영 DB에 실행하지 않는다. `playwright.config.ts`의 `webServer`로 로컬 백엔드와 프론트 개발 서버를 띄우고 테스트 DB(G-04)에 연결한다. 브라우저는 Chromium 하나만 쓴다(G-13).
- Q-18 테스트마다 새 계정을 만든다(이메일에 실행 시각과 난수 접미사). 계정, 팀, 할일 같은 사전 데이터는 UI가 아니라 `e2e/fixtures/`의 API 호출로 만든다. UI로 검증하는 대상 흐름만 화면에서 조작한다. 다른 테스트나 이전 실행이 남긴 데이터에 의존하지 않아 순서와 무관하게 통과해야 한다.
- Q-19 요소는 `getByRole`, `getByLabel`, `getByText`로만 찾는다. 버튼과 입력에는 보이는 텍스트나 `<label>`을 붙이고, 아이콘만 있는 버튼(햄버거 메뉴, 삭제 등)에는 `aria-label`을 붙인다. Playwright MCP의 접근성 스냅샷도 같은 이름을 쓴다. `data-testid`, CSS 선택자, `waitForTimeout`은 쓰지 않는다.
- Q-20 서버 현재 시각에 따라 결과가 바뀌는 판정(R5 분 단위 경계, 기한 초과 전환)은 E2E에서 단언하지 않는다. 이 경계는 Q-01 단위 테스트로 고정한다. E2E 데이터의 일시는 실행 시점과 무관하게 상태가 정해지는 값(먼 미래, 먼 과거)을 쓴다.
- Q-21 `main` 머지 전에 `npx playwright test` 전체를 통과시킨다. 실패하면 실패 테스트의 trace와 스크린샷(`test-results/`)으로 원인을 찾고, 필요하면 Playwright MCP로 같은 흐름을 재현한다. `playwright-report/`와 `test-results/`는 커밋하지 않는다.

### 4.3 Lint, 포맷, 타입

- Q-10 ESLint와 Prettier를 루트 설정 하나로 공유한다 [가정 G-05]. 커밋 전에 린트와 테스트를 통과시킨다.
- Q-11 프론트엔드는 `tsc --noEmit`을 통과해야 한다. 백엔드는 JavaScript이므로 타입 검사를 강제하지 않는다.
- Q-12 §2의 레이어 규칙(BE-01, BE-04, FE-01–FE-03)은 `import/no-restricted-paths` 같은 lint 규칙으로 옮겨 자동으로 막는다 [가정 G-05].
- Q-16 `shared/components/ui/`는 생성 코드이므로 ESLint의 `react-refresh/only-export-components` 규칙에서 뺀다. Prettier에는 `prettier-plugin-tailwindcss`로 클래스 순서를 맞춘다 [가정 G-16].
- Q-13 `console.log`는 커밋하지 않는다. 백엔드의 에러 로그는 `error-handler.js`에서만 남긴다(OPS-06). 프론트엔드의 `console` 직접 호출은 `shared/lib/logger.ts` 한 파일에만 두고, 나머지 코드는 `logger`를 거친다(OPS-25).

### 4.4 리뷰

- Q-14 1인 개발(PRD K2)이므로 동료 리뷰는 없다. 기능 단위 브랜치에서 작업하고, 아래 셀프 체크리스트를 PR 본문에 확인한 뒤 `main`에 머지한다.
  1. 권한 조건이 `access.js` 조각으로 들어갔는가(BE-05).
  2. 볼 수 없는 리소스는 404, 볼 수만 있는 리소스의 변경은 403인가(P-05).
  3. 타인 할일 응답에 카테고리 정보가 없는가(SEC-06).
  4. 상태 코드와 에러 코드가 시나리오 §6.2와 일치하는가(OPS-07).
  5. 쓰기 경로에 길이, 필수, R3 검증이 있는가(SEC-08, SEC-09).
  6. 여러 쓰기는 `withTransaction`으로 묶였고, 연결은 `finally`에서 반납되는가(BE-08, OPS-12).
  7. 로그와 응답에 비밀, 해시, 토큰, 개인정보가 없는가(P-06, OPS-05).
  8. 테스트를 추가했는가(Q-08, Q-09).
- Q-15 커밋 메시지는 Conventional Commits 접두사(`feat:`, `fix:`, `docs:`, `chore:`)를 쓴다. 기존 git 로그 형식과 맞춘다.

## 5. 설정, 보안, 운영 원칙

### 5.1 환경변수와 시크릿

| ID | 원칙 |
|----|------|
| OPS-01 | 시크릿(DB 연결 문자열, JWT 서명 키)은 Vercel 환경변수에만 둔다. 저장소에 커밋하지 않는다. `.env*`는 `.gitignore`에 넣고, 시크릿 값 없이 키를 적은 `backend/.env.example`만 커밋한다. |
| OPS-02 | 서버 환경변수는 `config/env.js`에서만 읽는다. 값이 없거나 형식이 틀리면 기동을 실패시킨다. 다른 파일에서 `process.env`를 직접 읽지 않는다. |
| OPS-03 | 프론트엔드 번들에 들어가는 변수(`VITE_` 접두사)는 공개 값만 둔다. |

| 변수 | 용도 | 근거 |
|------|------|------|
| `DATABASE_URL` | Supabase 트랜잭션 풀러(포트 6543) 연결 문자열 [가정 G-08] | PRD §5.1 B2 |
| `JWT_SECRET` | JWT 서명 키. `HS384`용으로 48바이트 이상의 무작위 값이며, 짧으면 `config/env.js`가 기동을 실패시킨다 [가정 G-08] | PRD §5.2 A26 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트(선택값). 둘 다 있어야 Google 로그인이 켜지고, 하나라도 없으면 소셜 로그인 경로가 404다(키 없이 로컬·테스트 기동 가능). 시크릿이라 OPS-01을 따른다 | PRD §5.2 소셜 로그인, A34 |
| `APP_URL` | 프론트 출처(소셜 로그인 후 되돌아갈 곳). 선택값이고 없으면 `CORS_ORIGINS`의 첫 값. 끝의 `/`는 제거한다 | PRD §5.2 소셜 로그인 |
| `API_URL` | API 출처(Google에 알리는 `redirect_uri` `{API_URL}/api/auth/oauth/google/callback` 생성용). 선택값이고 없으면 `http://localhost:{PORT}`. 끝의 `/`는 제거한다. 운영에서는 반드시 설정한다 | PRD §5.2 소셜 로그인 |

### 5.2 인증과 인가

| ID | 원칙 | 근거 |
|----|------|------|
| SEC-01 | 비밀번호는 8자 이상, UTF-8 72바이트 이하를 검증한 뒤 `bcryptjs`(cost 10)로 해시해서만 저장한다. 평문과 해시는 응답과 로그에 나가지 않는다. | PRD §5.2 B4, 도메인 §3.4 |
| SEC-02 | 액세스 토큰(JWT, 15분)과 리프레시 토큰(7일 절대 만료)을 각각 `httpOnly; Secure; SameSite=Lax` 쿠키로 발급한다(프론트와 API가 서로 다른 사이트로 배포되면 `COOKIE_SAMESITE=none`으로 `SameSite=None`). 리프레시 쿠키는 `Path=/api/auth`다. 리프레시 토큰은 원문이 아니라 SHA-256 해시만 `refresh_tokens`에 저장하고, `POST /api/auth/refresh` 때마다 회전한다(쓴 토큰 폐기 + 새 토큰 발급, 한 트랜잭션). 폐기된 토큰이 다시 오면 그 사용자의 리프레시 토큰을 모두 폐기한다. 로그아웃은 리프레시 토큰 폐기와 쿠키 삭제, 비밀번호 변경은 그 사용자의 리프레시 토큰 행을 모두 삭제하고(폐기 표시가 아니라 삭제. 남겨 두면 다른 브라우저가 옛 토큰으로 갱신할 때 재사용 감지가 방금 발급한 새 토큰까지 폐기해 변경한 브라우저도 로그아웃된다, EX-44) 현재 브라우저에 토큰을 새로 발급한다. 탈취된 액세스 토큰은 만료(최대 15분)까지 유효하다는 한계를 알고 있다. | PRD §5.2 A25, 시나리오 D-03, EX-42–EX-44 |
| SEC-03 | JWT 페이로드에는 사용자 ID(`sub`)와 만료 시각만 담는다. 역할, 팀, 권한을 넣지 않고, 권한은 요청마다 DB로 확인한다. 서명과 검증은 `HS384`만 쓴다(`jwt.verify`의 `algorithms: ['HS384']`). 서명 키는 48바이트 이상이다. | PRD §5.2 A26, 시나리오 US-15 #2 |
| SEC-04 | `authenticate` 미들웨어는 `/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `GET /api/auth/oauth/:provider`, `GET /api/auth/oauth/:provider/callback`, `GET /api/health`를 뺀 모든 `/api/*` 라우터에 기본 적용한다(소셜 로그인 두 경로는 로그인 전에 브라우저가 이동하는 경로라 공개다). 갱신은 액세스 토큰이 만료된 상태에서 호출되고, 로그아웃은 만료된 상태에서도 쿠키를 지울 수 있어야 하므로 공개다(두 경로는 리프레시 쿠키로만 동작). 헬스는 배포 확인(OPS-21)을 쿠키 없이 하기 위해 공개이고, 응답은 서버·DB 상태만 따로 담는다: 정상 `200 {"server":"ok","db":"ok"}`, DB 연결 실패 `503 {"server":"ok","db":"error"}`. 에러 내용 등 내부 정보는 담지 않고 서버 로그에만 남긴다. 공개 경로를 늘리려면 이 문서를 먼저 고친다. | 도메인 R1, UC-01–03, PRD A25 |
| SEC-05 | 로그인 실패는 이메일 존재 여부를 드러내지 않는다. 없는 이메일과 틀린 비밀번호는 같은 `INVALID_CREDENTIALS` 응답이다. 비밀번호 해시가 NULL인 소셜 전용 계정도 bcrypt 비교 없이 같은 응답이다. 비밀번호 변경에서 해시가 NULL이면 `WRONG_PASSWORD`다. | PRD FR-01 #5, FR-12 #8, 시나리오 EX-04, EX-47 |
| SEC-06 | 다른 사용자 할일의 응답에서는 카테고리 필드를 응답 생성 함수 한 곳에서 제거한다. 라우트마다 따로 제거하지 않는다. | 도메인 R2, PRD §5.2 |
| SEC-07 | 상태 변경은 `POST`, `PATCH`, `DELETE`만 쓴다. 프론트와 API는 CORS로 연결한다: 허용 출처는 환경변수 `CORS_ORIGINS`(쉼표 구분, 개발 `http://localhost:5173`)이고, 허용 출처에만 `Access-Control-Allow-Origin`(요청 출처 그대로, `*` 금지)과 `Access-Control-Allow-Credentials: true`를 준다. 허용 목록 밖 출처의 상태 변경 요청은 403 `FORBIDDEN`으로 거부한다(CSRF 방어, `SameSite=None`일 때도 유효). 같은 출처(개발 Swagger UI)와 `Origin` 없는 요청(curl)은 통과한다. CSRF 토큰은 두지 않는다. 구현은 `middleware/cors.js`(패키지 없음). 예외: 소셜 로그인 콜백 `GET /api/auth/oauth/:provider/callback`은 제공자 리다이렉트가 `GET`이라 `GET`이지만 로그인 처리(계정 생성·연결, 쿠키 발급)를 한다. `state` 쿠키 비교(SEC-13)가 요청 위조를 막는다. | PRD §5.2 CSRF 결정(2026-11-05 개정), 소셜 로그인 |
| SEC-13 | 소셜 로그인은 백엔드가 주도하는 Authorization Code + state 흐름이다. 시작 경로가 32바이트 무작위 `state`와 검증한 `next`를 `httpOnly; Secure; SameSite=Lax` 쿠키 `oauth_state`(10분, `Path=/api/auth/oauth`)에 저장하고, 콜백은 쿠키를 지운 뒤 쿠키와 쿼리의 `state`를 상수 시간 비교한다. 불일치·`code` 없음·교환 실패는 모두 `{APP_URL}/login?error=OAUTH_FAILED`로 302하고(내부 정보는 서버 로그에만), 이메일 없음·미확인은 `OAUTH_EMAIL_REQUIRED`다. `next`는 프론트 `safeNext`와 같은 규칙(`/`로 시작하고 `//`·`/\`로 시작하지 않음)으로 검증하고 아니면 `/`다. 제공자 호출(`fetch`)은 10초 제한이다. 계정 결정은 `auth.service.js`의 `oauthLogin` 한 곳이고 한 `withTransaction`에서 처리하며(R22), 이메일·identity 유일 충돌은 1회 다시 시도한다. 토큰 쿠키는 기존 `setTokenCookies`·`issueTokens`를 그대로 쓴다. | PRD §5.2 소셜 로그인, 도메인 R22, 시나리오 EX-45–EX-49 |

### 5.3 입력 검증

| ID | 원칙 | 근거 |
|----|------|------|
| SEC-08 | 모든 입력은 서버에서 검증한다. 필수 여부, 형식, 길이는 routes에서 검증하고, 도메인 규칙(R3, R7, R19, R21)은 services와 domain에서 검증한다. | PRD §5.2 신뢰 경계 |
| SEC-09 | 길이는 앞뒤 공백을 제거한 뒤 센다. 단, 비밀번호는 공백을 제거하지 않고 입력값 그대로 검사·해시한다(시나리오 C-23). 이메일 254자, 비밀번호 8자 이상·UTF-8 72바이트 이하(하한은 글자 수, 상한은 bcrypt가 72바이트까지만 쓰므로 바이트 수로 검사), 이름, 카테고리 이름, 팀 이름 1–50자, 할일 제목 1–200자, 설명 0–2,000자다. | 시나리오 §6.3 |
| SEC-10 | 요청 본문은 100KB로 제한한다(`express.json({ limit: '100kb' })`). 초과는 413 `PAYLOAD_TOO_LARGE`다. | PRD §5.2 A19 |
| SEC-11 | 일시는 ISO 8601 + 오프셋 형식만 받는다. 오프셋이 없으면 400이다 [가정 G-06]. 예외로 날짜만(`YYYY-MM-DD`) 보낸 값은 받고, 서버(`period.js`)가 요청자 시간대 기준 시작 00:00, 종료 23:59를 채운다(R5). | PRD §5.3 A20, 도메인 R5 |
| SEC-12 | 정렬, 필터, 역할 같은 열거 값은 허용 목록에 있는 값만 받는다. 목록에 없는 값은 400이다. | BE-07 |

### 5.4 로깅

| ID | 원칙 | 근거 |
|----|------|------|
| OPS-04 | 백엔드는 요청 로그 코드를 두지 않는다. 메서드, 경로, 상태 코드, 처리 시간은 Vercel 기본 함수 로그로 본다. 백엔드 코드에서 남기는 로그는 OPS-06의 5xx 에러 로그뿐이다(Q-13) [가정 G-10]. 프론트엔드의 개발 모드 로그는 OPS-25를 따른다. | Q-13 |
| OPS-05 | 로그에 비밀번호, 쿠키, JWT, 이메일, 이름, 할일 제목과 설명, 요청·응답 본문을 남기지 않는다. 사용자는 ID로만 식별한다(프론트 `logger`도 같다). | P-06 |
| OPS-06 | 5xx의 스택 트레이스는 `error-handler.js`에서만 기록한다. 응답에는 `INTERNAL_ERROR`만 보낸다. | 시나리오 §6.2 |
| OPS-25 | 프론트엔드 로그는 `shared/lib/logger.ts`의 `logger.debug/info/warn/error(scope, message, data?)`로만 남기고, `import.meta.env.DEV`(개발 모드)일 때만 `[scope] message data` 형식으로 `console`에 출력한다. 운영 빌드에서는 출력하지 않는다(빌드에서 `console` 호출은 제거되지만 `logger` 호출부의 문자열은 번들에 남는다). 로깅 지점은 API 클라이언트(method, path, status, 소요 ms, 토큰 갱신), React Query 쿼리·뮤테이션 오류(key, code), 라우트 변경, 로그인·가입·로그아웃의 성공과 실패(userId, code), AuthGuard 리다이렉트, 언어·테마 변경, 전역 에러 배너다. 로그 메시지는 개발자용 한국어 문자열이며 `t()` 대상이 아니다(FE-11 예외). 테스트(`src/test/setup.ts`)는 `console.debug`·`console.info`를 조용히 처리한다. | Q-13, OPS-05, [가정 G-10] |

### 5.5 에러 처리

| ID | 원칙 | 근거 |
|----|------|------|
| OPS-07 | 에러 응답은 `{ "error": { "code", "message", "fields"? } }` 형식 하나로 통일한다. 상태 코드, 코드, 메시지는 시나리오 §6.2 표를 따른다. | 시나리오 §6.2 C-05, PRD §5.2 |
| OPS-08 | services는 `AppError(status, code, message)`를 던지고, HTTP 응답으로 바꾸는 일은 `error-handler.js` 한 곳에서만 한다. 예상하지 못한 예외는 500 `INTERNAL_ERROR`가 된다. | BE-02 |
| OPS-09 | 트랜잭션이 실패하면 `ROLLBACK`한 뒤 원래 에러를 다시 던진다. 연결 반납은 `finally`에서 한다(OPS-12). | PRD K6 |
| OPS-10 | 프론트엔드는 코드로 분기한다. 401은 `shared/api/client.ts`가 `POST /api/auth/refresh`로 한 번 갱신한 뒤 원래 요청을 한 번 다시 보내고(동시에 받은 401은 갱신 요청 하나로 합친다, 갱신·로그인·가입·로그아웃 요청은 제외), 갱신도 실패하면 SC-01로 이동(ST-01)하되, 로그인 화면의 `INVALID_CREDENTIALS`는 폼 오류로 보여준다. 403은 ST-03, 404 `NOT_FOUND`는 ST-02, 413과 5xx와 네트워크 오류는 ST-04다. 400, 409와 구성원 추가의 404 `USER_NOT_FOUND`는 폼·필드 오류로 보여준다(와이어프레임 §3.2, §4.10). 메시지는 `error.code`의 번역(`error.<code>` 키)을 보여주고, 번역 키가 없는 코드만 서버의 `error.message`를 그대로 보여준다(FE-11). `fields`는 한국어일 때만 그대로 쓰고 그 밖의 언어는 `error.VALIDATION_FIELD` 번역을 쓴다. 소셜 로그인 실패 코드(`OAUTH_FAILED`, `OAUTH_EMAIL_REQUIRED`)는 응답 본문이 아니라 `/login?error=` 쿼리로 오므로 로그인 화면이 같은 번역 helper로 보여준다. | 와이어프레임 §3.5, §4.2, PRD FR-13 |

### 5.6 데이터베이스와 성능

| ID | 원칙 | 근거 |
|----|------|------|
| OPS-11 | `pg.Pool`은 `config/db.js`에서 모듈 최상위에 한 번만 만든다. 설정은 `max: 5`, `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 5000`이고, 연결은 Supabase 트랜잭션 풀러(포트 6543)를 쓴다. | PRD §5.1 B2 |
| OPS-12 | 트랜잭션은 `pool.connect()`로 얻은 클라이언트를 `try/finally`로 감싸 `release()`한다. 단건 쿼리는 `pool.query()`를 쓴다. | PRD §5.1 |
| OPS-13 | 이름 있는 prepared statement(`name` 옵션)는 쓰지 않는다. 트랜잭션은 한 요청 안에서 끝낸다. | PRD §5.1 B3 |
| OPS-14 | DB 세션 시간대는 `Asia/Seoul`, 일시 컬럼은 `timestamptz`를 쓴다. 트랜잭션 풀러는 연결별 `SET`을 유지하지 않으므로 Supabase 프로젝트마다 `ALTER DATABASE … SET timezone TO 'Asia/Seoul'`로 DB 기본값을 고정하고, 코드에서 `SET TIME ZONE`을 하지 않는다(PRD A28). R4의 '오늘'은 서버에서 `User.timezone` 기준으로 계산한다. 상태 판정의 현재 시각은 서버 시각을 분 단위로 자른다. | 도메인 R5, PRD §5.3 |
| OPS-15 | 목록은 `limit`과 `offset`을 쓴다. 기본 50건, 최대 100건, 정렬은 `start_at` 오름차순이다. 응답에 필터 적용 후 `total`을 포함한다. | PRD §5.1 U-12 |
| OPS-16 | 캘린더 조회(`GET /api/todos?from=&to=`, N-11)는 범위를 최대 42일, 결과를 최대 500건으로 제한한다. 42일을 넘는 범위는 400 `VALIDATION_ERROR`다. 결과가 상한에 걸리면 응답에 `truncated: true`를 넣는다. | PRD §5.1 U-13, 시나리오 EX-39 |
| OPS-17 | 목록과 캘린더는 1회 쿼리에 공유 팀 같은 연관 데이터를 JOIN이나 집계로 함께 가져온다(N+1 금지). 상태는 SQL에서 계산해 필터와 정렬에 쓴다. | PRD §5.1 |
| OPS-18 | 스키마 변경은 `backend/src/db/migrations/`의 순번 SQL 파일로만 한다. 적용한 파일 이름은 실행 스크립트(`npm run db:migrate`)가 만드는 `schema_migrations` 테이블에 기록하고 다음 실행에서 건너뛴다(도구 테이블이라 ERD 엔티티가 아니다). 인덱스는 PRD §5.1의 목록(이메일 소문자 유일, 카테고리 (소유자, 정규화 이름) 유일, 팀 정규화 이름 유일, 할일 (소유자, 시작·종료), 할일 공유 (팀, 할일), 팀 구성원 (사용자), 이력 (할일, 일시))과 팀당 OWNER 1명 부분 유니크 인덱스(OPS-23), 사용자당 기본 카테고리 1개 부분 유니크 인덱스, 카테고리 복합 FK용 `UNIQUE (id, owner_id)`, 카테고리 삭제용 `idx_todos_category_id`, 리프레시 토큰의 `uq_refresh_tokens_token_hash`·`idx_refresh_tokens_user_id`를 포함한다. 전체 목록은 `docs/7-erd.md` 3.2다. 스키마가 아닌 운영 작업(OPS-24의 `pg_cron` 등록)은 마이그레이션에 넣지 않고 `backend/src/db/ops/`의 SQL 파일로 남긴다. | PRD §5.1, `docs/7-erd.md` E-02·E-04·E-12, [가정 G-07] |
| OPS-24 | 만료된 리프레시 토큰은 Supabase `pg_cron`으로 매일 04:00(DB 시간대) `DELETE FROM refresh_tokens WHERE expires_at < now()`로 지운다. 폐기됐지만 만료 전인 행은 재사용 감지(SEC-02)를 위해 남긴다. 작업 SQL은 `backend/src/db/ops/refresh-token-cleanup.sql`에 두고 운영 프로젝트에 1회 등록한다. 테스트 DB는 리셋되므로 등록하지 않는다. 앱 코드에는 정리 경로를 두지 않는다. | PRD §5.1 A27, K12 |
| OPS-23 | 참조 무결성과 데이터 제약은 마이그레이션 SQL에 다음과 같이 둔다. ① 사용자·팀을 참조하는 FK(`todo_histories.actor_id`, `todo_shares.team_id`, `team_members.user_id`, `team_members.team_id`, `todos.owner_id`, `categories.owner_id` 등)는 `ON DELETE RESTRICT`다. ② `todo_shares.todo_id`, `todo_histories.todo_id`는 `ON DELETE CASCADE`라 할일 삭제 때 함께 지워진다. ③ 구성원 제거 때의 `todo_shares` 정리는 FK로 연쇄하지 않고 service가 같은 트랜잭션에서 직접 `DELETE`한다(BE-08). ④ 팀당 OWNER 1명은 부분 유니크 인덱스 `UNIQUE (team_id) WHERE role = 'OWNER'`로 보장한다. ⑤ 소유권 이전은 반드시 기존 소유자를 강등하거나 삭제한 뒤 새 소유자를 승격하는 순서로 처리한다(④ 때문에 반대 순서는 인덱스 위반이다). ⑥ `todos`의 카테고리 FK는 `(category_id, owner_id)` → `categories (id, owner_id)` 복합 FK이고 `ON DELETE RESTRICT`다. 카테고리 삭제는 할일을 기본 카테고리로 옮긴 뒤 지운다(R9). ⑦ 공유 팀이 소유자가 속한 팀이라는 조건(R21)은 트리거 없이 service가 검증한다. ⑧ CHECK 제약과 `updated_at` 갱신 방식은 `docs/7-erd.md` 3.3을 따른다. | 도메인 §3.9, R7, R9, R18, R21, `docs/7-erd.md` |

### 5.7 배포

| ID | 원칙 | 근거 |
|----|------|------|
| OPS-19 | Vercel로 배포한다. 프론트는 정적 빌드하고, `api/index.js`가 Express 앱을 함수로 노출한다. 브라우저는 `VITE_API_BASE_URL`의 API 출처로 `/api/*`를 호출하고 API는 CORS로 허용한다(SEC-07). 프로젝트를 하나로 둘지 나눌지는 실행 계획 W-09 | PRD §5.1 Q1 |
| OPS-20 | 운영은 HTTPS만 쓴다. 쿠키 `Secure`는 운영 전제이며, 로컬 개발은 `localhost`에서 확인한다 [가정 G-13]. | PRD §5.2 |
| OPS-21 | Day 1 오전에 빈 API(`/api/health` [가정 G-06])를 먼저 배포해 Express 함수와 콜드 스타트를 확인한다. | PRD K10 |
| OPS-22 | 배포 순서는 마이그레이션 적용(003 소셜 로그인 포함. 운영 DB 적용 전에 사용자 확인을 받는다), 운영 작업(OPS-24) 등록 확인, 소셜 로그인 환경변수·Google 콘솔 Redirect URI 등록(`{API_URL}/api/auth/oauth/google/callback`), 백엔드와 프론트 배포다. 운영 지표 M1–M5는 Vercel과 Supabase 대시보드로 확인한다. 부하 테스트는 하지 않는다. | PRD K3, Q2 [가정 G-15] |

## 6. 디렉토리 구조

### 6.1 저장소 최상위

```
todolist-app/
├─ api/
│  └─ index.js          # Vercel Functions 진입점. backend/src/app.js를 import해 export
├─ backend/             # Express API (JavaScript)
├─ frontend/            # React 19 + TypeScript SPA (Vite)
├─ docs/                # 기획·설계 문서 1–9 (8은 API 명세 yaml, 9는 스타일 가이드)
├─ e2e/                 # @playwright/test E2E (Q-05, Q-17–Q-21)
│  ├─ fixtures/         # API로 계정, 팀, 할일을 만드는 헬퍼
│  ├─ auth.spec.ts      # 가입, 로그인, 로그아웃
│  ├─ todos.spec.ts     # 할일 등록, 수정, 완료, 삭제, 목록 필터
│  ├─ calendar.spec.ts  # 캘린더 월, 주, 일 전환과 클릭 이동
│  ├─ categories.spec.ts
│  ├─ teams.spec.ts     # 팀 생성, 구성원 관리, 공유
│  └─ permissions.spec.ts  # 비구성원 404, 일반 팀원 403, 관리자 수정, 공유 없는 할일 404 (EX-20, EX-21, US-14, EX-25)
├─ playwright.config.ts # webServer(백엔드, 프론트), Chromium, baseURL
├─ vercel.json          # /api/* 라우팅, SPA 경로 fallback [가정 G-01]
├─ package.json         # 루트 공통 스크립트와 의존성 [가정 G-01]
└─ .gitignore           # .env*, playwright-report/, test-results/ 포함
```

- `api/` 아래에는 `index.js`만 둔다. Vercel은 이 폴더의 모든 파일을 함수로 취급한다.

### 6.2 프론트엔드 구조

```
frontend/
├─ index.html
├─ components.json              # shadcn 설정. aliases를 @/shared/components/ui, @/shared/lib/utils로 지정 [가정 G-16]
├─ tsconfig.json                # @/ → src/ 경로 별칭
├─ vite.config.ts               # 빌드 설정, @/ 별칭, Tailwind 플러그인, 개발 서버 5173, API는 프록시 없이 CORS로 호출 [가정 G-14]
└─ src/
   ├─ main.tsx                  # 진입점: ThemeProvider(next-themes), i18n import, QueryClientProvider, 라우터 마운트
   ├─ index.css                 # Tailwind 진입점, shadcn 테마 변수(라이트 `:root`, 다크 `.dark`), 캘린더 막대 변수 `--bar-*`
   ├─ test/
   │  └─ setup.ts               # 테스트 공통 설정 (Radix용 jsdom 보완, Q-04, i18n을 ko로 고정, console.debug·info 무음)
   ├─ app/
   │  ├─ App.tsx                # 라우트 정의 (SC-01–SC-09)
   │  ├─ AuthGuard.tsx          # 401 → SC-01, ?next= 처리 (ST-01)
   │  └─ AppLayout.tsx          # 공통 레이아웃 (SC-00)
   ├─ pages/                    # 화면 1개 = 파일 1개
   │  ├─ LoginPage.tsx          # SC-01
   │  ├─ SignupPage.tsx         # SC-02
   │  ├─ TodoListPage.tsx       # SC-03
   │  ├─ TodoEditPage.tsx       # SC-04 (등록, 편집, 읽기 전용, 이력 탭)
   │  ├─ CalendarPage.tsx       # SC-05
   │  ├─ CategoriesPage.tsx     # SC-06
   │  ├─ ProfilePage.tsx        # SC-07 (P1)
   │  ├─ TeamsPage.tsx          # SC-08
   │  └─ TeamDetailPage.tsx     # SC-09
   ├─ features/                 # 도메인 모듈
   │  ├─ auth/                  # 로그인, 가입, 로그아웃 훅 (User). `components/SocialLoginButtons.tsx`(Google 버튼)
   │  ├─ users/                 # 내 정보 조회, 수정 훅 (User, P1)
   │  ├─ categories/            # 카테고리 훅과 컴포넌트 (Category). `categoryName.ts`(기본 카테고리 이름 번역)
   │  ├─ todos/                 # 목록, 상세, 폼, 행, 필터 바, 상태 배지 (Todo, TodoShare)
   │  │  └─ calendar/           # 캘린더 뷰와 훅 (SC-05)
   │  ├─ teams/                 # 팀, 구성원 훅과 표 (Team, TeamMember)
   │  └─ todo-histories/        # 이력 목록 (TodoHistory, P1)
   ├─ shared/
   │  ├─ api/
   │  │  ├─ client.ts           # fetch 래퍼, credentials, 에러 본문 파싱
   │  │  ├─ errorMessage.ts     # ApiError 표시 번역(`error.<code>`, fields) 한 곳 (FE-11)
   │  │  └─ queryKeys.ts        # TanStack Query 키 팩토리 (invalidate 단위)
   │  ├─ i18n/
   │  │  ├─ index.ts            # i18next 초기화(언어 결정 순서, `<html lang>` 갱신)
   │  │  └─ locales/            # ko.json(기준), en.json, zh.json, ja.json + locales.test.ts(키·보간 변수 일치)
   │  ├─ components/
   │  │  ├─ ui/                 # shadcn 생성 컴포넌트 (button, input, select, table, badge, dialog, alert-dialog, sheet, alert, skeleton, pagination 등)
   │  │  ├─ ConfirmDialog.tsx   # AlertDialog 래퍼 (DLG 확인 대화상자)
   │  │  ├─ LanguageSelect.tsx  # 언어 메뉴(헤더·모바일 Sheet·로그인·가입)
   │  │  ├─ ThemeToggle.tsx     # 테마 메뉴(헤더·모바일 Sheet)
   │  │  └─ ErrorBanner.tsx     # Alert 래퍼 (ST-03, ST-04 상단 알림 막대)
   │  ├─ lib/                   # utils.ts (shadcn cn), dateTime.ts (시간대 포맷), logger.ts (개발 모드 전용 console 로그, OPS-25) 등 순수 유틸
   │  └─ types/                 # 서버 응답 타입 (camelCase)
   └─ stores/                   # Zustand UI 상태
      ├─ todoFilterStore.ts     # 보기(F4), 카테고리, 상태 필터
      └─ calendarStore.ts       # 뷰(월, 주, 일), 기준일
```

| 경로 | 역할 | 허용 import |
|------|------|-------------|
| `src/main.tsx` | 앱 시작점. 프로바이더와 라우터를 마운트한다. | app, shared |
| `src/app/` | 라우트, 인증 가드, 공통 레이아웃 | pages, features, shared, stores |
| `src/pages/` | 화면 단위 조합. 파일 하나가 SC-ID 하나에 대응한다 | features, shared, stores |
| `src/features/<도메인>/` | 도메인별 서버 상태 훅과 컴포넌트. 권한 플래그에 따라 표시를 바꾼다 | shared, stores |
| `src/shared/api/` | HTTP 클라이언트와 쿼리 키. 여기서만 `fetch`를 쓴다 | 없음 |
| `src/shared/components/` | 도메인과 무관한 UI 부품. 하위 `ui/`는 shadcn 생성 코드(FE-08, FE-09, N-02 예외) | shared 내부 |
| `src/shared/lib/`, `src/shared/types/` | 순수 유틸과 공통 타입. `lib/utils.ts`는 shadcn의 `cn`(clsx + tailwind-merge) | 없음 |
| `src/stores/` | 서버와 무관한 UI 상태만 둔다. 서버 데이터는 두지 않는다(FE-05) | 없음 |

- 테스트 파일은 대상 파일 옆에 둔다(N-05).
- 화면 경로(`app/App.tsx`): SC-01 `/login`, SC-02 `/signup`, SC-03 `/todos`, SC-04 `/todos/new`(등록, `?teamId=` 기본 팀)·`/todos/:todoId`(편집·읽기 전용), SC-05 `/calendar`, SC-06 `/categories`, SC-07 `/me`, SC-08 `/teams`, SC-09 `/teams/:teamId`. `/`와 없는 경로는 `/todos`로 보낸다.

### 6.3 백엔드 구조

```
backend/
├─ src/
│  ├─ app.js                    # Express 앱 조립: JSON(100kb), /api 라우터, error-handler
│  ├─ server.js                 # 로컬 실행용 listen + 개발용 Swagger UI(/swagger). 배포 진입점에서 import하지 않는다
│  ├─ config/
│  │  ├─ env.js                 # 환경변수 검증
│  │  └─ db.js                  # pg.Pool 단일 인스턴스, withTransaction
│  ├─ middleware/
│  │  ├─ cors.js                # CORS_ORIGINS 허용 출처에 CORS 헤더, 목록 밖 출처의 상태 변경 403
│  │  ├─ authenticate.js        # 액세스 토큰(HS384) 쿠키 검증 → req.user, 실패 401
│  │  └─ error-handler.js       # AppError → 에러 응답, 그 밖은 500
│  ├─ routes/                   # HTTP 경계 (<모듈>.routes.js)
│  │  ├─ index.js               # /api 마운트, 공개 경로 외 authenticate 적용
│  │  ├─ auth.routes.js         # POST /api/auth/signup, login, refresh, logout, GET /api/auth/oauth/:provider(와 /callback)
│  │  ├─ users.routes.js        # GET, PATCH /api/me (P1: 비밀번호 변경 포함)
│  │  ├─ categories.routes.js
│  │  ├─ todos.routes.js        # 목록·캘린더(기간 필터), 등록, 수정, 삭제
│  │  ├─ teams.routes.js        # 팀, 구성원, 나가기, 내 캘린더 색
│  │  └─ todo-histories.routes.js   # P1
│  ├─ services/                 # 유스케이스, 권한, 트랜잭션 (<모듈>.service.js)
│  │  ├─ auth.service.js        # 가입·로그인·갱신·로그아웃·`oauthLogin`(R22)
│  │  ├─ oauth.providers.js     # 제공자 설정(URL·scope·프로필 파싱), 인가 URL, code 교환·프로필 조회(`fetch`)
│  │  ├─ users.service.js
│  │  ├─ categories.service.js
│  │  ├─ todos.service.js       # 응답 생성(카테고리 제거, SEC-06) 포함
│  │  ├─ teams.service.js
│  │  └─ todo-histories.service.js  # P1
│  ├─ domain/                   # 순수 규칙. 외부 import 없음
│  │  ├─ todo-status.js         # S1–S4 판정, now는 분 단위
│  │  ├─ period.js              # R3 검증, R4 기본값, R5 기본 시각
│  │  ├─ history-diff.js        # 필드별 이전→새 값, 카테고리와 공유 팀 필터 (P1)
│  │  └─ errors.js              # AppError, 에러 코드 상수
│  ├─ repositories/             # SQL 전담 (<모듈>.repo.js)
│  │  ├─ sql/
│  │  │  └─ access.js           # 권한 WHERE 조각 (R2, R19, R21). 이 파일에만 둔다
│  │  ├─ auth.repo.js           # refresh_tokens
│  │  ├─ identities.repo.js     # user_identities
│  │  ├─ users.repo.js
│  │  ├─ categories.repo.js
│  │  ├─ todos.repo.js          # todo_shares 포함
│  │  ├─ teams.repo.js          # team_members 포함
│  │  └─ todo-histories.repo.js     # P1
│  └─ db/
│     ├─ migrations/            # 순번 SQL 파일 (P1 테이블 포함)
│     └─ ops/                   # 운영 작업 SQL (pg_cron 등록, OPS-24)
├─ tests/
│  ├─ unit/                     # domain 규칙 테스트
│  └─ integration/              # 실제 PostgreSQL 대상 테스트
└─ .env.example             # 키 견본. 같은 폴더의 .env(개발)·.env.test(테스트)로 복사. 시크릿 값은 비움
```

| 경로 | 역할 | 허용 import |
|------|------|-------------|
| `api/index.js` (루트) | Vercel 함수 진입점. `backend/src/app.js`를 export한다 | app |
| `src/app.js` | Express 앱 조립. 에러 핸들러는 마지막에 등록한다 | routes, middleware, config |
| `src/server.js` | 로컬 실행 전용. 개발 모드(`npm run dev`)에서만 Swagger UI를 `/swagger`에 붙인다. 명세 원본은 `docs/8-swagger.yaml` 하나이고, 화면에는 문자열 `description`을 뺀 명세를 보낸다(설명문은 문서에만 둔다). 배포 진입점(`api/index.js` → `app.js`)에는 없다 | app, config, `swagger-ui-express`, `js-yaml` |
| `src/config/` | 환경변수 검증, 풀, 트랜잭션 헬퍼 | 없음 |
| `src/middleware/` | CORS·Origin 검사, 인증, 에러 응답 변환 | config/env, domain/errors |
| `src/routes/` | HTTP 요청과 응답. 비즈니스 규칙을 두지 않는다 | services, middleware, domain/errors |
| `src/services/` | 유스케이스와 트랜잭션 경계 | domain, 같은 모듈 repositories, 다른 모듈 services |
| `src/domain/` | 순수 함수와 에러 타입 | 없음 |
| `src/repositories/` | SQL 실행과 이름 변환 | config/db, repositories/sql |
| `src/repositories/sql/access.js` | 권한 조건의 유일한 정의 | 없음 |
| `src/db/migrations/` | 스키마 변경 이력(SQL) | 없음 |
| `src/db/ops/` | 운영 DB에 1회 등록하는 작업 SQL(OPS-24) | 없음 |
| `tests/unit/` | domain 단위 테스트 | domain |
| `tests/integration/` | 실제 DB 대상 테스트 | app, services, repositories |

### 6.4 엔티티, 기능, 화면과 모듈 대응

| 도메인 엔티티, 기능 | 백엔드 모듈 | 프론트 features | 화면 |
|--------------------|-------------|-----------------|------|
| User (가입, 로그인, 로그아웃), UserIdentity (소셜 로그인) | auth | auth | SC-01, SC-02, SC-00 |
| User (내 정보) | users | users | SC-07 (P1) |
| Category | categories | categories | SC-06, SC-04 카테고리 필드 |
| Todo, TodoShare, 목록과 캘린더 | todos | todos, todos/calendar | SC-03, SC-04, SC-05 |
| Team, TeamMember | teams | teams | SC-08, SC-09 |
| TodoHistory | todo-histories (P1) | todo-histories (P1) | SC-04 이력 탭 |
| 인증 가드, 공통 에러 | middleware | app, shared/api | ST-01–ST-04 |

## 7. 가정 목록

기준 문서에 없어 이 문서에서 정한 항목이다. v0.6에서 모든 항목을 확정했다. 본문의 `[가정 G-xx]` 표시는 근거 추적용으로 남긴다.

- 미결 없음. 아래 항목은 반영 완료(문서 v0.6): G-04 테스트 DB 위치(Supabase 테스트 전용 프로젝트), 그리고 v0.5 정합성 검토에서 나온 미결 ①–③(① FE-06 예외와 FE-10, ② N-11 `/api/me` 예외, ③ OPS-04를 Vercel 기본 로그로 대체).
- (기록) v0.5 미결 내용: ① FE-06(클라이언트 시계 금지)과 G-11(날짜 라이브러리 없음)이 캘린더 요구와 맞는지. FullCalendar의 '오늘' 이동(FR-08 #1)은 기본으로 브라우저 시계를 쓰고, `User.timezone`이 브라우저 시간대와 다를 때(P1 FR-03, US-16 #5) 이름 있는 시간대 표시에는 별도 플러그인이 필요하다. ② `/api/me`(6.3 `users.routes.js`)가 N-11(복수형 명사 경로)의 예외인지. ③ OPS-04(요청 로그를 `console`로 기록)와 Q-13(`console.log` 커밋 금지, 에러 로그는 `error-handler.js`에서만)의 관계와 요청 로그를 남기는 위치(6.3 `middleware/`에 없음).
- (기록) v0.16: 프론트 개발 모드 로깅 구현(`shared/lib/logger.ts`)으로 ③의 결론(코드의 로그는 백엔드 `error-handler.js`뿐, `console` 직접 호출 금지)이 프론트에는 맞지 않게 됐다. 구현된 사실만 OPS-25로 반영했다: 프론트의 `console` 직접 호출은 `logger.ts` 한 파일뿐이고 개발 모드에서만 출력한다. Q-13, OPS-04, OPS-05, FE-11 예외, G-10을 함께 고쳤다. 백엔드 규칙(요청 로그 코드 없음, 5xx는 `error-handler.js`에서만)은 그대로다. 미결 없음.

| ID | 항목 | 가정 내용 |
|----|------|-----------|
| G-01 | 저장소 구조 | `api/`, `backend/`, `frontend/`를 한 저장소에 둔다. 루트 `package.json` 하나를 쓴다. `vercel.json`으로 `/api/*`를 함수로 라우팅한다. |
| G-02 | 모듈 방식 | 백엔드와 프론트는 ESM(`import`, `export`)을 쓴다. Node는 Vercel이 지원하는 최신 LTS를 쓰고 `package.json`의 `engines`에 고정한다. 패키지 매니저는 npm이다. |
| G-03 | 빌드 도구 | 프론트 빌드는 Vite다(PRD §6, §8.1 근거). |
| G-04 | 테스트 도구, 테스트 DB | 단위 테스트는 Vitest, 백엔드 통합 테스트는 Vitest와 supertest, E2E 회귀는 `@playwright/test`(루트 `e2e/`), Playwright MCP는 탐색과 스크립트 작성 보조(Q-05, Q-17–Q-21). 통합 테스트와 E2E는 운영과 분리한 Supabase 테스트 전용 프로젝트(PostgreSQL 17)를 쓴다. 연결 문자열은 커밋하지 않는 `.env.test`의 `DATABASE_URL`에 두고, 스키마는 운영과 같은 마이그레이션(OPS-18)으로 만든다. Docker는 쓰지 않는다. |
| G-05 | 린트, 포맷 | ESLint와 Prettier를 루트 설정으로 공유한다. 레이어 규칙은 lint 규칙으로 옮긴다. 테스트 파일 명명은 N-05를 따른다. |
| G-06 | API와 응답 세부 | 영문 상태 값(`NOT_STARTED` 등), 쿼리 파라미터 이름(`from`, `to`, `status`, `categoryId` 등), 권한 플래그(`canEdit`, `isOwner`), 헬스 경로(`/api/health`, 공개, SEC-04), 오프셋 없는 일시 거부와 날짜만 보낸 값 예외(SEC-11). |
| G-07 | DB 명명과 마이그레이션 | 테이블과 컬럼은 snake_case 복수형, 인덱스는 N-19 규칙을 따른다. 식별자는 `uuid`이고 기본값은 `gen_random_uuid()`다(URL의 ID 추측 방지, P-05). 마이그레이션은 순번 SQL 파일이다. ORM이 없으므로 마이그레이션 도구는 쓰지 않는다. |
| G-08 | 환경변수 이름 | 백엔드 `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`(필수, 쉼표 구분 출처), `COOKIE_SAMESITE`(선택, `lax` 기본·`none`), `ACCESS_TOKEN_TTL_MINUTES`(선택, 기본 15), `REFRESH_TOKEN_TTL_DAYS`(선택, 기본 7), `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`(선택, 둘 다 있어야 Google 로그인 활성), `APP_URL`(선택, 기본 `CORS_ORIGINS` 첫 값), `API_URL`(선택, 기본 `http://localhost:{PORT}`). 만료 값은 1 이상 정수만 받고, 틀리면 기동 실패(OPS-02). 프론트 `VITE_API_BASE_URL`(API 출처, 개발 `http://localhost:3000`). |
| G-09 | 인증 세부 | JWT는 `jsonwebtoken`(`HS384`), 쿠키 파싱은 `cookie-parser`를 쓴다. 쿠키 이름은 `access_token`, `refresh_token`이다. 리프레시 토큰 생성과 해시는 Node `crypto`(`randomBytes(32)`, SHA-256)로 한다. |
| G-10 | 로깅 도구 | 백엔드: 요청 로그는 Vercel 기본 함수 로그로 보고, 코드의 로그는 `error-handler.js`의 `console.error`뿐이다(OPS-04, OPS-06). 프론트엔드: 개발 모드에서만 출력하는 `shared/lib/logger.ts`(`console` 래퍼)가 있다(OPS-25). 구조화 로그 라이브러리는 두지 않는다. |
| G-11 | 캘린더 라이브러리 | PRD §6이 허용한 오픈소스 캘린더 라이브러리(예: FullCalendar, react-big-calendar) 중 FullCalendar(`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, MIT)를 쓴다. 날짜 라이브러리(localizer)와 시간대 플러그인 없이 월·주·일 뷰와 `+N`을 지원한다. 시간대는 FE-10, '오늘' 이동은 FE-06 예외를 따른다. 코드는 `features/todos/calendar/`에 둔다. |
| G-12 | 커버리지 | 수치 목표는 두지 않는다. 규칙 추적(Q-08)으로 대신한다. |
| G-13 | 로컬 쿠키 | Chrome과 Firefox는 `http://localhost`에서도 `Secure` 쿠키를 저장한다. 로컬 개발과 E2E는 Chromium 계열 브라우저로 하고, 개발 환경 예외 코드는 두지 않는다. |
| G-14 | 개발 서버 연결 | 프론트 개발 서버(Vite `http://localhost:5173`)는 프록시 없이 로컬 백엔드(`http://localhost:3000`)를 CORS로 직접 호출한다(2026-11-05 변경, SEC-07). |
| G-15 | 배포 환경 | Vercel의 Production과 Preview 환경변수를 나눈다. 배포 순서는 OPS-22를 따른다. |
| G-16 | shadcn 설정 | Tailwind CSS v4, shadcn 기본 스타일과 기본 색(neutral), 아이콘 `lucide-react`. `npx shadcn init` 직후, 첫 `add` 전에 `components.json`의 aliases를 `shared/components/ui`, `shared/lib/utils`로 바꾼다. 클래스 정렬은 `prettier-plugin-tailwindcss`를 쓴다. |

- 기준 문서 사이에 서로 충돌하는 규칙은 찾지 못했다. 빌드 도구(Vite)가 PRD §8.1에만 있던 누락은 PRD v0.10에서 §6에 추가했다.

## 8. 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| v0.1 | 2026-11-04 | hjining | 최초 작성. 도메인 정의서 v0.11, PRD v0.8, 사용자 시나리오 v0.6, 와이어프레임 v0.4 기반. 공통 원칙(P-01–P-09), 레이어 규칙(BE, FE), 네이밍(N), 테스트(Q), 보안·운영(SEC, OPS), 프론트와 백엔드 디렉토리 구조, 가정 G-01–G-15 |
| v0.2 | 2026-11-04 | hjining | UI 컴포넌트로 shadcn/ui 채택(PRD v0.9): 1.2 스택, FE-08·FE-09, N-02 예외, N-10, Q-04 테스트 설정, Q-16, 6.2 프론트 구조(`components.json`, `index.css`, `shared/components/ui/`, `test/setup.ts`), G-16 추가. 기준 문서 버전 갱신 |
| v0.3 | 2026-11-04 | hjining | 7장 가정 확정: 식별자 uuid(G-07), `jsonwebtoken`·`cookie-parser`·쿠키 `access_token`(G-09), FullCalendar(G-11), Node LTS `engines` 고정(G-02), localhost `Secure` 쿠키(G-13), shadcn init 순서(G-16), 나머지 가정 유지 확정. E2E를 Playwright MCP로 수행(Q-05 개정, 4.2.1 Q-17–Q-20 추가, 1.2 테스트 스택). G-04 테스트 DB 위치만 미결(Docker 미사용 가능성 높음) |
| v0.4 | 2026-11-04 | hjining | E2E 회귀 검증을 `@playwright/test` 스크립트로 수행: 1.2 테스트 스택, N-05 E2E 파일 명명, Q-05 개정, 4.2.1 Q-17–Q-21(실행 환경, 데이터 준비, 선택자, 시각 의존 단언 금지, 머지 전 실행), 6.1에 `e2e/`·`playwright.config.ts` 추가, G-04 갱신. Playwright MCP는 탐색과 스크립트 작성 보조로 역할 변경 |
| v0.5 | 2026-11-04 | hjining | 문서 정합성 검토: 기준 문서 버전 갱신(PRD v0.10, 사용자 시나리오 v0.8, 와이어프레임 v0.6). 표기에 인용 ID(PRD·시나리오·와이어프레임)와 `Q-xx`·`P-xx`의 구분 추가. 인용 정정: P-03 근거(K4·K5는 PRD §9), N-05 예시(할일 등록은 US-04), Q-01 근거(EX-07), Q-02·`permissions.spec.ts`(관리자 수정 성공은 US-14, EX-25는 공유 없는 할일 404), Q-05(US-10 수동 검증 예외), OPS-10(404 `NOT_FOUND`만 ST-02, 400·409·`USER_NOT_FOUND`는 폼 오류), OPS-18 근거 열 누락, `ErrorBanner` ST-03 포함, BE-08에 구성원 제거와 공유 해제 추가. 캘린더: PRD §6 허용 범위 안에서 FullCalendar를 고른 관계 명시(1.2, G-11), `+N` 클릭 시 일 뷰(`moreLinkClick`, U-13). Vite 근거에 PRD §6 추가(1.2, G-03, 7장). 7장에 새 미결 3건 추가 |
| v0.6 | 2026-11-04 | hjining | 7장 미결 전부 확정: G-04 테스트 DB는 Supabase 테스트 전용 프로젝트(`.env.test`, Docker 미사용). ① FE-06에 캘린더 화면 이동용 브라우저 시계 예외, FE-10(캘린더 일시는 오프셋을 뗀 벽시계 값 + `timeZone: 'UTC'`, 시간대 플러그인 없음) 추가, G-11 갱신. ② N-11에 `/api/me` 예외 명시. ③ OPS-04를 요청 로그 코드 없음(Vercel 기본 로그)으로 바꾸고 G-10 갱신 |
| v0.7 | 2026-11-04 | hjining | 기준 문서 버전 갱신(도메인 v0.12, PRD v0.11, 사용자 시나리오 v0.9, 와이어프레임 v0.7). 기술 아키텍처(`docs/6-arch-diagram.md`) 확인 필요 T-02·T-04·T-06·T-07·T-08 결정 반영: N-11에 API 경로 추가(캘린더 `GET /api/todos?from=&to=`, 구성원 목록 재사용, 카테고리, 구성원 제거·역할 변경)와 자기 제거 경로 규칙, N-12 이력 1건 규칙, SEC-01·SEC-09 비밀번호 '8자 이상, UTF-8 72바이트 이하', OPS-16 42일 초과 400, OPS-18 부분 유니크 인덱스, OPS-23 추가(FK RESTRICT/CASCADE, 소유권 이전 순서). 6.1 `docs/` 주석을 문서 1–6으로 정정 |
| v0.8 | 2026-11-04 | hjining | 기준 문서 버전 갱신(사용자 시나리오 v0.10, 와이어프레임 v0.8). SEC-09에 비밀번호 공백 미제거 예외(시나리오 C-23). N-11에 `GET /api/teams`(팀 목록·내 역할), `POST /api/teams`(팀 생성) 추가, 팀 단건 조회·이름 변경·삭제 경로는 두지 않음 명시 |
| v0.9 | 2026-11-04 | hjining | 기준 문서 버전 갱신(도메인 v0.13, PRD v0.12, 사용자 시나리오 v0.11, 와이어프레임 v0.9). ERD(`docs/7-erd.md`) 확인 필요 E-01–E-12 결정 반영: N-18 `password_hash`, N-19 복합·표현식 인덱스 이름과 이메일 일반 유일 제약(PK·FK·CHECK 무명), OPS-18 인덱스 추가(기본 카테고리 부분 유니크, `UNIQUE (id, owner_id)`, `idx_todos_category_id`), OPS-23 ⑥–⑧(카테고리 복합 FK·RESTRICT, 공유 팀 service 검증, CHECK·`updated_at`은 ERD 3.3) |
| v0.10 | 2026-11-04 | hjining | 기준 문서 버전 갱신(PRD v0.13, 사용자 시나리오 v0.12, 와이어프레임 v0.10). PRD A25–A28 반영: 1.2 인증 행, SEC-02(리프레시 토큰 회전·재사용 감지·폐기), SEC-03(`HS384` 고정, 키 48바이트), SEC-04(공개 경로에 refresh·logout), `JWT_SECRET` 길이, OPS-10(401 → 갱신 → 재시도), OPS-14(`ALTER DATABASE`로 시간대 고정), OPS-18(리프레시 토큰 인덱스, 운영 작업 SQL 위치), OPS-22, OPS-24 추가(`pg_cron` 만료 토큰 정리), Q-02 인증 테스트, BE-08 리프레시 토큰 회전, 6.3 구조(`auth.repo.js`, `db/ops/`), G-09. 6.1 `docs/` 주석을 문서 1–7로 정정(ERD 추가 반영 누락) |
| v0.11 | 2026-11-04 | hjining | 기준 문서 버전 갱신(PRD v0.14, 사용자 시나리오 v0.13, 와이어프레임 v0.11). API 명세(`docs/8-swagger.yaml`) 확인 필요 결정 반영: SEC-04 공개 경로에 `GET /api/health` 추가(응답 고정), SEC-11에 날짜만 보낸 값 예외(근거에 R5 추가), N-14에 같은 예외 연결, G-06에 헬스 공개와 날짜만 예외 명시 |
| v0.12 | 2026-11-05 | hjining | 백엔드 구현(실행 계획 DB-03, API-12) 결과 반영: SEC-02 비밀번호 변경 시 리프레시 토큰을 폐기 표시가 아니라 삭제(EX-44, 재사용 감지와 충돌 방지), OPS-18 마이그레이션 적용 기록 `schema_migrations` 테이블 |
| v0.13 | 2026-11-05 | hjining | SEC-04 헬스 응답을 서버·DB 상태 분리로 변경(정상 200 `{"server":"ok","db":"ok"}`, DB 실패 503 `{"server":"ok","db":"error"}`). 1.2·6.3에 개발 모드 전용 Swagger UI(`/swagger`, 설명문 제외, 배포 경로에 없음) 추가. 기준 문서 버전 갱신(PRD v0.15, 사용자 시나리오 v0.14, 와이어프레임 v0.12). 프론트·API 연결을 CORS로 변경(PRD v0.15): 1.2 배포, 2장 middleware, SEC-02(`COOKIE_SAMESITE`), SEC-07(CORS 허용 목록·Origin 검사), OPS-19, 6.2 `vite.config.ts`, 6.3 `cors.js`, G-08 환경변수, G-14 프록시 없음 |
| v0.14 | 2026-11-05 | hjining | N-11 경로 예시에 `PATCH /api/teams/:teamId/color`(요청자 본인의 팀 캘린더 색상만 변경, 실행 계획 6.3 CL-02) 추가 |
| v0.15 | 2026-11-05 | hjining | 문서 정합성 검토: 기준 문서 버전 갱신(도메인 v0.14, PRD v0.16, 사용자 시나리오 v0.15, 와이어프레임 v0.14). 제목 줄에 잘못 들어가 있던 변경 요약을 이력으로 이동: OPS-19에서 '단일 프로젝트' 삭제(PRD v0.15, W-09 미결), G-08에 토큰 만료 환경변수 `ACCESS_TOKEN_TTL_MINUTES`·`REFRESH_TOKEN_TTL_DAYS`(기본 15분·7일), `.env.example`을 `backend/.env.example`로 이동(프론트는 UI-01에서 `frontend/.env.example`, 6.1·6.3 구조, OPS-01). FE-09에 팀 캘린더 팔레트 색의 인라인 `style` 예외(PRD A29, 스타일 가이드 1장), 6.1 `docs/` 주석 1–9로 정정, 6.3 `teams.routes.js` 주석에 내 캘린더 색. 6.2에 화면 경로(SC-01–SC-09) 목록 추가 |
| v0.16 | 2026-11-05 | hjining | 다국어·테마·Google 소셜 로그인 반영(DOC-01, 계획서 `docs-local/261105-i18n-theme-social-plan.md`), 기준 문서 버전 갱신(도메인 v0.14, PRD v0.16, 사용자 시나리오 v0.15, 와이어프레임 v0.14): P-07 범위 밖 목록 조정, 1.2 다국어·테마·소셜 로그인 스택, FE-11(i18n 문자열·번역 파일 규칙)·FE-12(테마 구현), 5.1 환경변수 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`·`APP_URL`·`API_URL`, SEC-04 공개 경로에 OAuth 두 경로, SEC-05 소셜 전용 계정, SEC-07·N-13 콜백 `GET` 예외, SEC-13(OAuth 흐름·state·`next` 검증), OPS-10 오류 번역 우선, OPS-22 배포 순서, N-11·N-16·N-17·N-19, G-08, 6.2·6.3 구조(`shared/i18n/`, `errorMessage.ts`, `LanguageSelect`·`ThemeToggle`, `SocialLoginButtons`, `oauth.providers.js`, `identities.repo.js`), 6.4. 프론트 개발 모드 전용 콘솔 로깅 구현(`shared/lib/logger.ts`, 커밋 7c6a5f7) 반영: OPS-25 추가(출력 조건, 로깅 지점, 미기록 항목, 한국어 메시지, 테스트 무음 처리), Q-13(프론트 `console` 직접 호출은 `logger.ts` 한 파일), OPS-04(백엔드 한정, 프론트는 OPS-25), OPS-05(요청·응답 본문 추가), FE-11 예외(로그 메시지는 `t()` 대상 아님), N-08, G-10, 6.2 구조(`shared/lib/logger.ts`, `test/setup.ts`), 7장 기록 |
| v0.17 | 2026-11-06 | hjining | 문서 정합성 검토: 기준 문서 버전 갱신(도메인 v0.15, PRD v0.17, 사용자 시나리오 v0.16, 와이어프레임 v0.15). 기본 카테고리 이름 번역 표시(커밋 fb235b4) 반영: FE-11에 `categoryName()` 규칙, 6.2 `categories/` 주석에 `categoryName.ts`. 구현 기준 추가 동기화: 1.2 캘린더 행의 `moreLinkClick`을 실제 구현(`timeGridDay` 전환)으로 정정, `defaultTimedEventDuration` 추가(E2E 결함 수정 bf5d8ca) |
