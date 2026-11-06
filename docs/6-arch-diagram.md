# TodoList 기술 아키텍처 다이어그램

| 항목 | 내용 |
|------|------|
| 문서 버전 | v0.11 |
| 상태 | 초안 |
| 최종 수정일 | 2026-11-06 |
| 작성자 | hjining |
| 기준 문서 | `docs/1-domain-definition.md` v0.15, `docs/2-prd.md` v0.17, `docs/3-user-scenario.md` v0.16, `docs/4-wireframe.md` v0.15, `docs/5-project-principle.md` v0.17 |

> 표기
> - 근거는 기준 문서의 ID와 절로 쓴다. 도메인 규칙 `R`·`S`·`F`·`UC`, 도메인 절 `도메인 §n`, PRD 절 `PRD §n`과 PRD ID(`A`, `B`, `K`, `M`), 시나리오 `US-xx`·`EX-xx`·`C-xx`(시나리오 6장은 `시나리오 §6`), 와이어프레임 `SC`·`ST`·`DLG`·`U-xx`, 프로젝트 원칙 `P-xx`·`BE-xx`·`FE-xx`·`SEC-xx`·`OPS-xx`·`G-xx`.
> - 이 문서는 기준 문서에 있는 기술 스택·구조·규칙만 그린다. 새 기술, 인프라, 기능을 더하지 않는다. 기준 문서에 없어서 그림에서 정할 수 없었던 부분은 6장 '확인 필요 사항'에 모았다.
> - 모든 다이어그램은 Mermaid이며 GitHub에서 렌더링된다.
> - 변경 이력은 문서 맨 아래(7장)에 있다.

## 1. 개요

### 1.1 목적
구현 전에 시스템 구성, 레이어 의존 방향, 데이터 관계, 비즈니스 로직이 복잡한 흐름을 한눈에 볼 수 있게 한다. 코드 이름과 레이어 이름은 프로젝트 구조 설계 원칙(`docs/5-project-principle.md`)을 그대로 쓴다.

### 1.2 다이어그램 목록
| 절 | 제목 | 종류 |
|----|------|------|
| 2 | 시스템 전체 기술 아키텍처 | flowchart |
| 3.1 | 요청 처리 계층 흐름 (UI → 훅 → API 클라이언트 → routes → services → repositories → DB) | flowchart |
| 3.2 | 프론트엔드 레이어 의존 구조 | flowchart |
| 3.3 | 백엔드 레이어 의존 구조 | flowchart |
| 4 | 도메인 엔티티 관계 | → `docs/7-erd.md`로 분리 |
| 5.1 | 공통 요청 처리: 인증·권한 판정·에러 변환 | sequenceDiagram |
| 5.2 | 회원가입: 계정과 기본 카테고리 동시 생성 | sequenceDiagram |
| 5.3 | 할일 등록: 팀·소유자·공유 팀·일시 채움 | sequenceDiagram |
| 5.4 | 할일 수정·완료·삭제: 권한 판정과 이력 | sequenceDiagram |
| 5.5 | 목록·캘린더 조회: 권한·필터·상태 계산 | sequenceDiagram |
| 5.6 | 카테고리 삭제: 할일을 기본 카테고리로 이동 | sequenceDiagram |
| 5.7 | 팀 구성원 추가·제거와 공유 해제 | sequenceDiagram |
| 5.8 | 소유자의 팀 나가기: 다음 소유자 지정 (P1) | sequenceDiagram |
| 5.9 | 변경 이력 조회: 보는 사람별 필터링 (P1) | sequenceDiagram |
| 5.10 | 토큰 갱신·로그아웃: 리프레시 토큰 회전과 폐기 | sequenceDiagram |
| 5.11 | Google 소셜 로그인: state 검증과 계정 결정 | sequenceDiagram |

## 2. 시스템 전체 기술 아키텍처

- 배포는 Vercel이고, 프론트엔드 정적 빌드와 Express API(Vercel Functions, `/api/*`)를 배포한다. 프론트는 `VITE_API_BASE_URL`의 API 출처를 CORS로 호출한다(PRD §5.1·§5.2, SEC-07, OPS-19). 프로젝트를 하나로 둘지 나눌지는 미결이다(실행 계획 W-09).
- PostgreSQL 17은 Supabase를 DB로만 쓴다. Supabase Auth와 자동 생성 API는 쓰지 않는다(B1). 인증은 앱이 직접 발급하는 액세스 토큰(`HS384` JWT, 15분)과 리프레시 토큰(7일, DB에 해시) 쿠키다(PRD §5.2). 예외로 만료 리프레시 토큰 정리에 `pg_cron`을 쓴다(PRD A27, OPS-24).
- 외부 인증 서비스는 Google OAuth(소셜 로그인) 하나다. 앱 서버가 Google 인가·토큰·프로필 엔드포인트를 서버 `fetch`로 직접 호출하고(PRD §5.2 소셜 로그인, SEC-13), Supabase Auth는 쓰지 않는다. Google 외 소셜 로그인, 알림, 외부 캘린더 연동은 범위 밖이다(도메인 §7).
- 언어(`react-i18next`)와 테마(`next-themes`)는 브라우저 안에서만 동작하고 서버·DB에 저장하지 않는다(PRD A30, A31). 번역 파일은 정적 번들에 포함된다.
- 프론트엔드는 개발 모드(`import.meta.env.DEV`)에서만 `shared/lib/logger.ts`로 브라우저 콘솔에 로그를 남기고 운영 빌드는 출력하지 않는다. 서버·외부로 로그를 보내지 않으며, 운영 로그는 Vercel 함수 로그뿐이다(프로젝트 원칙 OPS-04, OPS-25).

```mermaid
flowchart TB
    subgraph CL["클라이언트"]
        BR["데스크톱 브라우저<br/>Chrome, Edge, Safari, Firefox 최신 2개 버전"]
        MB["모바일 브라우저 (반응형 웹)<br/>iOS Safari, Android Chrome 최신 2개 버전"]
    end

    subgraph VC["Vercel (HTTPS, 프론트·API 출처는 CORS로 연결)"]
        subgraph FEL["프론트엔드 계층 (정적 빌드)"]
            SPA["React 19 + TypeScript SPA<br/>빌드: Vite"]
            TQ["TanStack Query<br/>서버 상태 조회, 캐시, invalidate"]
            ZS["Zustand<br/>UI 상태만: 필터, 캘린더 뷰와 기준일, 모달"]
            UI["shadcn/ui (Tailwind CSS, Radix UI, lucide-react)<br/>FullCalendar, 브라우저 기본 date/time input"]
            I18["react-i18next 번역 4개(ko·en·zh·ja), next-themes<br/>localStorage lang, theme"]
        end
        subgraph BEL["백엔드/API 계층 (Vercel Functions, 서버리스)"]
            FN["api/index.js<br/>Express 앱 노출 (/api/*)"]
            MW["middleware<br/>authenticate (쿠키 JWT), error-handler"]
            RS["routes → services → repositories<br/>domain: 순수 규칙"]
            POOL["config/db<br/>pg.Pool (max 5), withTransaction"]
        end
        ENV["Vercel 환경변수<br/>DATABASE_URL, JWT_SECRET, CORS_ORIGINS,<br/>GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, API_URL"]
        LOG["Vercel 함수 로그, 대시보드<br/>운영 지표 M1–M5 확인"]
    end

    subgraph DS["데이터 저장소 (Supabase, DB로만 사용)"]
        SUP["Supavisor 커넥션 풀러<br/>트랜잭션 모드, 포트 6543"]
        PG[("PostgreSQL 17")]
        CRON["pg_cron<br/>매일 04:00 만료 refresh_tokens 삭제"]
    end

    GG["Google OAuth<br/>인가·토큰·userinfo 엔드포인트"]
    NOEXT["Supabase Auth, 자동 생성 API 미사용"]

    BR -->|"HTTPS: 정적 자원"| SPA
    MB -->|"HTTPS: 정적 자원"| SPA
    SPA --> TQ
    SPA --> ZS
    SPA --> UI
    SPA --> I18
    BR -.->|"소셜 로그인: 페이지 이동 (302)"| GG
    FN -->|"서버 fetch: code 교환, 프로필 조회 (10초 제한)"| GG
    TQ -->|"shared/api/client.ts<br/>VITE_API_BASE_URL/api/* (CORS, credentials include), httpOnly 쿠키 JWT"| FN
    FN --> MW
    MW --> RS
    RS --> POOL
    POOL -->|"pg, parameterized query"| SUP
    SUP --> PG
    CRON -.-> PG
    ENV -.-> FN
    FN -.-> LOG
    FN -.- NOEXT
    PG -.- LOG
```

## 3. 계층·모듈 구조

### 3.1 요청 처리 계층 흐름

화면에서 DB까지 한 방향으로만 흐른다. 각 칸의 이름은 `docs/5-project-principle.md` 2장의 레이어 이름이다.

```mermaid
flowchart LR
    UIC["pages, features 컴포넌트<br/>(UI 컴포넌트, shadcn/ui)"]
    HK["features 훅<br/>TanStack Query"]
    ST["stores<br/>Zustand UI 상태"]
    CLI["shared/api/client.ts<br/>fetch 래퍼"]
    RT["routes<br/>형식, 길이 검증"]
    SV["services<br/>유스케이스, 권한, 트랜잭션"]
    DM["domain<br/>todo-status, period, history-diff, errors"]
    RP["repositories<br/>SQL, camelCase 변환"]
    CF["config/db<br/>pg.Pool"]
    DB[("PostgreSQL 17<br/>Supabase 풀러")]

    UIC --> HK
    UIC -.->|"필터, 뷰 상태 읽기"| ST
    HK --> CLI
    CLI -->|"HTTP /api/*"| RT
    RT --> SV
    SV --> DM
    SV --> RP
    RP --> CF
    CF --> DB
```

### 3.2 프론트엔드 레이어 의존 구조

의존 방향은 `app → pages → features → shared`이고 `stores`는 아무것도 import하지 않는다(PRD §6, FE-01–FE-05).

```mermaid
flowchart TB
    subgraph FE["frontend/src"]
        APP["app<br/>라우트 SC-01–SC-09, AuthGuard (ST-01), AppLayout (SC-00)"]
        PAGES["pages<br/>화면 1개 = 파일 1개 (LoginPage, TodoListPage, TodoEditPage 등)"]
        FEAT["features<br/>auth, users, categories, todos (calendar 포함), teams, todo-histories<br/>서버 상태 훅과 도메인 컴포넌트"]
        SHARED["shared<br/>api (client.ts, queryKeys.ts), components (ui = shadcn), lib, types"]
        STORES["stores<br/>todoFilterStore, calendarStore"]
    end

    APP --> PAGES
    PAGES --> FEAT
    FEAT --> SHARED
    APP -.-> FEAT
    APP -.-> SHARED
    APP -.-> STORES
    PAGES -.-> SHARED
    PAGES -.-> STORES
    FEAT -.-> STORES
    SHARED -->|"HTTP /api/*"| API["백엔드 routes"]
```

| 금지 규칙 (요약) | 근거 |
|------------------|------|
| pages끼리 import 금지. features는 pages·app을 import하지 않음. shared는 features·pages·stores를 import하지 않음 | FE-01–FE-03 |
| HTTP는 `shared/api/client.ts`만 호출. 컴포넌트에서 `fetch` 직접 호출 금지 | FE-04 |
| 서버 응답 데이터를 Zustand에 복사 금지(이중 소스 방지) | FE-05, PRD §6 |
| 상태(S1–S4)·'오늘' 판정에 클라이언트 시계 사용 금지(캘린더 화면 이동 예외) | FE-06 |
| 편집·삭제 버튼과 카테고리 필드 활성 여부는 서버가 준 `canEdit`, `isOwner`로만 결정 | FE-07 |

### 3.3 백엔드 레이어 의존 구조

의존 방향은 `routes → services → repositories → config/db`이고 `domain`은 아무것도 import하지 않는다(BE-01–BE-09).

```mermaid
flowchart TB
    subgraph BE["backend/src (api/index.js가 app.js를 노출)"]
        APPJS["app.js<br/>JSON 100kb, /api 라우터, error-handler 마지막 등록"]
        MWA["middleware/authenticate<br/>쿠키 JWT → req.user, 실패 401"]
        MWE["middleware/error-handler<br/>AppError → 에러 응답, 그 밖은 500"]
        ROUTES["routes<br/>auth, users, categories, todos, teams, todo-histories"]
        SERVICES["services<br/>같은 이름의 모듈, 다른 모듈은 service로만 접근 (BE-06)"]
        DOMAIN["domain<br/>todo-status.js (S1–S4), period.js (R3–R5), history-diff.js, errors.js"]
        REPOS["repositories<br/>users, categories, todos (todo_shares), teams (team_members), todo-histories"]
        ACCESS["repositories/sql/access.js<br/>권한 WHERE 조각 (R2, R19, R21) 유일한 정의"]
        CONFIG["config<br/>env.js (환경변수 검증), db.js (pg.Pool, withTransaction)"]
    end
    DB[("PostgreSQL 17")]

    APPJS --> MWA
    APPJS --> ROUTES
    APPJS --> MWE
    MWA -->|"req.user"| ROUTES
    ROUTES --> SERVICES
    SERVICES --> DOMAIN
    SERVICES --> REPOS
    REPOS --> ACCESS
    REPOS --> CONFIG
    MWA -.-> CONFIG
    MWE -.->|"AppError 코드 상수"| DOMAIN
    CONFIG -->|"pg"| DB
```

| 금지 규칙 (요약) | 근거 |
|------------------|------|
| routes는 repositories와 `pg`를 import하지 않는다 | BE-01 |
| services는 `req`, `res`, HTTP 상태 코드를 다루지 않고 `AppError`로 던진다 | BE-02, OPS-08 |
| `pg`는 `config/db.js`와 `repositories/`에서만 import한다 | BE-04 |
| 권한 WHERE 조건은 `access.js` 조각으로만 쓴다 | BE-05, P-03 |
| 여러 쓰기는 service에서 `withTransaction`으로 묶는다(가입, 카테고리 삭제와 할일 이동, 구성원 제거와 공유 해제, 팀 나가기, 할일 변경과 이력) | BE-08 |

## 4. 도메인 엔티티 관계

ERD는 `docs/7-erd.md`로 분리했다. 엔티티 관계, 컬럼 타입, FK `ON DELETE`, 유일 제약·인덱스는 그 문서를 본다.

## 5. 복잡한 비즈니스 로직 상세 흐름

### 5.0 선별 기준
단순 CRUD(카테고리 이름 수정, 프로필 수정, 팀 생성, 내 캘린더 팀 색 변경 `PATCH /api/teams/:teamId/color` 등)는 그리지 않았다. 아래 중 하나 이상에 해당하는 흐름만 골랐다: 여러 쓰기를 한 트랜잭션으로 묶음, 역할별 권한 분기(404/403 구분), 입력에 따라 값이 바뀌는 기본값 규칙, 보는 사람에 따라 응답이 달라지는 규칙.

| 절 | 흐름 | 복잡한 이유 | 근거 |
|----|------|-------------|------|
| 5.1 | 공통 요청 처리 | 401·403·404·5xx를 한 곳에서 변환하고 프론트가 코드로 분기. 다른 모든 흐름의 전제 | R1, R2, P-05, OPS-07, OPS-08, OPS-10 |
| 5.2 | 회원가입 | 계정·기본 카테고리 원자성, 이메일 유일성(대소문자 무시), 가입 후 자동 로그인 | FR-01 #1·#2·#8, R6, R16, EX-01, C-01 |
| 5.3 | 할일 등록 | 팀 선택에 따른 소유자·공유 팀·카테고리 규칙, R4 일시 채움, 이력과 같은 트랜잭션 | FR-09 #5·#10, FR-11, R4, R7, R19, R21, EX-22, EX-26 |
| 5.4 | 할일 수정·완료·삭제 | 소유자·관리자·일반 팀원별 권한 분기, 카테고리·공유 팀은 소유자만, 완료 시각 처리 | FR-06, FR-07, R13, R14, R19, EX-20–EX-25, EX-33 |
| 5.5 | 목록·캘린더 조회 | 권한 WHERE, 필터 AND, 상태를 SQL로 계산한 뒤 페이지네이션, 카테고리 비노출 | FR-05 #6, R2, R15, F1–F4, S1–S4, OPS-15–OPS-17 |
| 5.6 | 카테고리 삭제 | 기본 카테고리 보호와 할일 이동·삭제의 원자성 | FR-02 #4·#5, R8, R9 |
| 5.7 | 구성원 추가·제거 | 소유자 전용, 중복·미가입 검사, 자기 제거 거부, 제거와 공유 해제의 원자성, 역할 변경 즉시 반영 | FR-09 #2·#8, FR-11 #5, R18, R21, EX-27, EX-28, EX-34, US-15 |
| 5.8 | 팀 나가기 (P1) | 소유자 위임·제거·공유 해제를 한 번에 처리, 위임 불가 조건과 검사 순서, 기존 소유자 삭제 → 새 소유자 승격 순서 | FR-09 #12, R18, R21, C-11, EX-29, EX-36, EX-40, EX-41 |
| 5.9 | 이력 조회 (P1) | 보는 사람에 따라 카테고리·공유 팀 변경을 걸러내고 빈 이력은 숨김 | FR-10 #4·#6, R20, C-17 |
| 5.10 | 토큰 갱신·로그아웃 | 401 후 자동 갱신·재시도, 회전의 원자성, 재사용 감지, 로그아웃 폐기 | FR-01 #7·#10, PRD A25, SEC-02, OPS-10, EX-42, EX-43 |
| 5.11 | Google 소셜 로그인 | 외부 제공자와의 리다이렉트·서버 간 호출, state 검증, 이메일 자동 연결·신규 가입을 한 트랜잭션으로, 실패 코드를 쿼리로 전달 | FR-12, R22, SEC-13, EX-45–EX-49 |

### 5.1 공통 요청 처리: 인증·권한 판정·에러 변환

근거: R1(인증 필수), R2·P-05(볼 수 없음은 404, 볼 수 있으나 권한 없음은 403), SEC-03(JWT에는 사용자 ID만, 권한은 요청마다 DB 확인), OPS-07·OPS-08·OPS-10(에러 변환과 프론트 분기). 이후 모든 흐름이 이 파이프라인 위에서 동작한다.

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant CL as 브라우저 shared/api/client.ts
    participant AM as middleware authenticate
    participant RT as routes
    participant SV as services
    participant DB as PostgreSQL
    participant EH as middleware error-handler

    U->>CL: 화면 조작
    CL->>AM: /api/* 요청 (쿠키 access_token)
    alt 공개 경로 (signup, login, refresh, logout, oauth, health)
        AM->>RT: 인증 없이 통과
    else 보호 경로
        alt 쿠키 없음, 서명 오류, HS384가 아닌 알고리즘, 만료(15분), 로그아웃으로 삭제됨
            AM-->>CL: 401 UNAUTHENTICATED
            CL->>CL: 토큰 갱신 후 한 번 재시도 (5.10)
            CL->>U: 갱신도 실패하면 ST-01 로그인 화면으로 이동 (?next= 보존)
        else 토큰 유효
            AM->>RT: req.user = 사용자 ID만 (역할과 팀은 토큰에 없음)
        end
    end
    RT->>RT: 형식, 길이 검증
    alt 검증 실패
        RT-->>CL: 400 VALIDATION_ERROR (fields)
    else 통과
        RT->>SV: 유스케이스 호출
        SV->>DB: 쿼리 (권한 WHERE 조각 포함, parameterized)
        alt 볼 수 없음 (공유 없음, 비구성원, 없는 ID)
            SV-->>EH: AppError 404 NOT_FOUND (존재 여부 비노출)
        else 볼 수 있으나 변경 권한 없음
            SV-->>EH: AppError 403 FORBIDDEN
        else 규칙 위반
            SV-->>EH: AppError 400 또는 409 (시나리오 6.2 코드)
        else 예상하지 못한 예외
            SV-->>EH: Error
            EH->>EH: 스택 트레이스 기록 (비밀, 개인정보 제외)
        end
        EH-->>CL: 에러 본문 (code, message, fields 선택)
    end
    opt 요청 본문 100KB 초과
        EH-->>CL: 413 PAYLOAD_TOO_LARGE
    end
    CL->>U: 코드로 분기. 403은 ST-03, 404는 ST-02, 413과 5xx와 네트워크 오류는 ST-04, 400과 409는 폼 필드 오류
```

### 5.2 회원가입: 계정과 기본 카테고리 동시 생성

근거: FR-01 #1(둘 중 하나라도 실패하면 둘 다 만들지 않음), R6(기본 카테고리 자동 생성), R16(이메일 유일, 대소문자 무시), C-01(가입 후 자동 로그인), SEC-01(bcryptjs cost 10), EX-01·EX-02.

```mermaid
sequenceDiagram
    autonumber
    actor U as 비인증 사용자
    participant FE as SignupPage SC-02
    participant RT as auth.routes
    participant SV as auth.service
    participant RP as users.repo, categories.repo, auth.repo
    participant DB as PostgreSQL

    U->>FE: 이메일, 비밀번호, 이름 입력 후 가입
    FE->>RT: POST /api/auth/signup
    RT->>RT: 형식, 길이 검증 (이메일 254, 비밀번호 8자 이상 72바이트 이하 공백 제거 없이, 이름 1-50)
    alt 검증 실패
        RT-->>FE: 400 VALIDATION_ERROR
    else 통과
        RT->>SV: signup
        SV->>SV: 이메일 앞뒤 공백 제거, 소문자 정규화
        SV->>SV: bcryptjs 해시 (cost 10), 평문은 저장하지 않음
        SV->>DB: BEGIN (withTransaction, pool.connect)
        SV->>RP: 사용자 INSERT (timezone 기본값 Asia/Seoul)
        RP->>DB: INSERT users
        alt 이메일 유일 인덱스 위반 (이미 가입, 동시 가입 포함)
            DB-->>RP: unique violation
            SV->>DB: ROLLBACK
            SV-->>RT: AppError 409 EMAIL_TAKEN
            RT-->>FE: 409 EMAIL_TAKEN (이메일 입력란 아래 표시)
        else 사용자 생성 성공
            SV->>RP: 기본 카테고리 INSERT (name 기본, isDefault true)
            RP->>DB: INSERT categories
            alt 기본 카테고리 생성 실패
                SV->>DB: ROLLBACK (계정도 생성되지 않음)
                SV-->>RT: Error
                RT-->>FE: 500 INTERNAL_ERROR
            else 성공
                SV->>RP: 리프레시 토큰 해시 INSERT (7일)
                SV->>DB: COMMIT
                SV-->>RT: 사용자
                RT-->>FE: 성공 + Set-Cookie access_token (HS384, 15분), refresh_token (7일, Path=/api/auth). 둘 다 httpOnly, Secure, SameSite=Lax
                FE->>U: SC-03 할일 목록으로 이동 (별도 로그인 없음)
            end
        end
    end
    Note over SV,DB: 어느 경로든 finally에서 client.release()
```

### 5.3 할일 등록: 팀·소유자·공유 팀·일시 채움

근거: 등록 화면에서 먼저 팀을 고르고(C-16), 그 팀의 관리자일 때만 소유자를 구성원 중에서 고른다(R19, FR-09 #10). 소유자가 본인이 아니면 카테고리는 소유자의 기본 카테고리, 공유 팀은 고른 팀으로 고정된다(R7, R19, FR-09 #5). 일시는 R4로 채우고(이때 '오늘'은 관리자가 대리 등록해도 요청자의 `User.timezone` 기준, PRD §5.3) R3을 검증하며, FR-10 구현 후에는 `CREATED` 이력이 같은 트랜잭션에 들어간다(A13).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자 (본인 또는 관리자)
    participant FE as TodoEditPage SC-04
    participant RT as todos.routes
    participant SV as todos.service
    participant TM as teams.service
    participant CT as categories.service
    participant DM as domain period, history-diff
    participant RP as todos.repo
    participant DB as PostgreSQL

    U->>FE: 팀 선택 (없음 = 개인 할일), 필요하면 소유자 선택, 입력 후 저장
    Note over FE: 소유자 필드와 카테고리 활성 여부는 편의 기능이며 서버가 최종 판정 (P-02)
    FE->>RT: POST /api/todos (팀, 소유자, 제목, 설명, 시작, 종료, 카테고리, 공유 팀)
    RT->>RT: 필수, 길이 (제목 1-200, 설명 2000), ISO 8601 오프셋 형식 검증 (날짜만은 SEC-11 예외)
    alt 검증 실패
        RT-->>FE: 400 VALIDATION_ERROR
    else 통과
        RT->>SV: create (요청자 = req.user)
        alt 팀 미선택 (개인 할일)
            SV->>SV: 소유자 = 요청자, 공유 팀 = 요청자가 고른 팀 (없을 수 있음)
        else 팀 선택
            SV->>TM: 요청자의 그 팀 역할 조회
            alt 요청자가 그 팀 구성원이 아님
                SV-->>FE: 400 INVALID_SHARE_TEAM
            else 구성원
                opt 소유자를 본인이 아닌 사람으로 지정
                    alt 요청자가 그 팀의 MANAGER 또는 OWNER가 아님
                        SV-->>FE: 403 FORBIDDEN (일반 팀원은 다른 사람을 소유자로 지정할 수 없음)
                    else 지정한 소유자가 그 팀 구성원이 아님
                        SV-->>FE: 400 INVALID_OWNER
                    end
                end
                SV->>SV: 소유자 확정, 소유자 != 요청자이면 공유 팀 = 고른 팀으로 고정
            end
        end
        SV->>TM: 공유 팀이 모두 소유자가 속한 팀인지 확인
        alt 속하지 않은 팀 포함
            SV-->>FE: 400 INVALID_SHARE_TEAM
        end
        alt 소유자 != 요청자
            opt 요청에 카테고리가 있음
                SV-->>FE: 403 FORBIDDEN (카테고리는 소유자만 지정)
            end
            SV->>CT: 소유자의 기본 카테고리 조회
        else 소유자 = 요청자
            alt 카테고리 지정
                SV->>CT: 본인 카테고리인지 확인
                opt 다른 사람 카테고리 또는 없는 ID
                    SV-->>FE: 404 NOT_FOUND
                end
            else 미지정
                SV->>CT: 기본 카테고리 조회
            end
        end
        SV->>DM: 일시 정규화 (R4 빈 값 채움, R5 기본 시각 00:00 또는 23:59, R3 검증). 오늘과 기본 일시는 요청자의 User.timezone 기준이며 소유자의 시간대가 아님
        alt 종료 일시가 시작 일시보다 빠름
            DM-->>SV: 위반
            SV-->>FE: 400 INVALID_PERIOD (같은 일시는 허용)
        else 정규화 성공
            SV->>DB: BEGIN (withTransaction)
            SV->>RP: todos INSERT (completed false)
            RP->>DB: INSERT todos
            SV->>RP: todo_shares INSERT (공유 팀마다)
            RP->>DB: INSERT todo_shares
            opt FR-10 구현 후 (P1)
                SV->>DM: CREATED 이력 변경 내용 (처음 값)
                SV->>RP: todo_histories INSERT (변경자 = 요청자)
                RP->>DB: INSERT todo_histories
            end
            alt 어느 쓰기든 실패
                SV->>DB: ROLLBACK (할일, 공유, 이력 모두 남지 않음)
                SV-->>FE: 500 INTERNAL_ERROR
            else 모두 성공
                SV->>DB: COMMIT
                SV->>SV: 응답 생성 (canEdit, isOwner 계산, 소유자가 요청자가 아니면 카테고리 필드 제거)
                SV-->>FE: 생성된 할일
                FE->>U: 목록 재조회 (invalidate), SC-03으로 이동
            end
        end
    end
    Note over SV,DB: 어느 경로든 finally에서 client.release()
```

### 5.4 할일 수정·완료·삭제: 권한 판정과 이력

근거: 같은 할일이라도 소유자, 그 팀의 관리자(소유자 포함), 일반 팀원, 비구성원에 따라 결과가 다르다(시나리오 4.1 권한 매트릭스, R13, R19, EX-20–EX-25). 카테고리와 공유 팀 변경은 소유자만 가능하다(R7, R21, EX-23, EX-24). 완료는 별도 경로 없이 `completed` 필드로 처리하고 `completedAt`은 서버가 설정한다(N-12, R14). 삭제는 영구 삭제이며 공유와 이력도 함께 삭제한다(R12, R20). 이력은 요청 1건에 1건이고, 완료 여부가 바뀌면 `COMPLETED`/`UNCOMPLETED`, 아니면 `UPDATED`이며 함께 바뀐 필드도 모두 `changes`에 담는다(R20, FR-10 #1).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자 (소유자, 관리자, 일반 팀원)
    participant FE as SC-03, SC-04
    participant RT as todos.routes
    participant SV as todos.service
    participant TM as teams.service
    participant CT as categories.service
    participant DM as domain period, history-diff
    participant RP as todos.repo, access.js
    participant DB as PostgreSQL

    U->>FE: 저장, 완료 체크, 삭제 확인 (DLG-01)
    FE->>RT: PATCH 또는 DELETE /api/todos/:todoId
    RT->>SV: update 또는 remove (인증은 5.1과 동일)
    SV->>RP: 볼 수 있는 할일 조회 (소유자 또는 공유 팀 구성원 조건)
    RP->>DB: SELECT (권한 WHERE 포함)
    alt 볼 수 없거나 없음
        DB-->>RP: 0행
        SV-->>FE: 404 NOT_FOUND (존재 여부 비노출)
    else 볼 수 있음
        SV->>TM: 공유 팀들에서 요청자 역할 조회
        alt 소유자도 아니고 어느 공유 팀에서도 MANAGER 또는 OWNER가 아님 (일반 팀원)
            SV-->>FE: 403 FORBIDDEN (화면은 읽기 전용이라 보통 도달하지 않음)
        else 수정 권한 있음
            alt DELETE
                SV->>DB: BEGIN
                SV->>RP: 할일 삭제 (공유와 이력은 FK ON DELETE CASCADE로 함께 영구 삭제)
                RP->>DB: DELETE
                alt 삭제된 행이 0 (다른 관리자가 먼저 삭제)
                    SV->>DB: ROLLBACK
                    SV-->>FE: 404 NOT_FOUND (ST-02, 목록 재조회)
                else 삭제 성공
                    SV->>DB: COMMIT
                    SV-->>FE: 성공 (같은 ID 재조회는 404)
                end
            else PATCH
                opt 카테고리 변경 요청
                    alt 요청자가 소유자가 아님 (관리자 포함)
                        SV-->>FE: 403 FORBIDDEN
                    else 소유자
                        SV->>CT: 본인 카테고리인지 확인
                        opt 다른 사람 카테고리 또는 없는 ID
                            SV-->>FE: 404 NOT_FOUND
                        end
                    end
                end
                opt 공유 팀 변경 요청
                    alt 요청자가 소유자가 아님 (관리자 포함)
                        SV-->>FE: 403 FORBIDDEN
                    else 소유자
                        SV->>TM: 새 공유 팀이 모두 소유자가 속한 팀인지 확인
                        opt 속하지 않은 팀 포함
                            SV-->>FE: 400 INVALID_SHARE_TEAM
                        end
                    end
                end
                SV->>DM: 변경 후 기간 검증 (R3, 같은 일시 허용)
                opt 종료 일시가 시작 일시보다 빠름
                    SV-->>FE: 400 INVALID_PERIOD
                end
                alt completed false → true
                    SV->>SV: completedAt = 서버 현재 시각 (시작 전이어도 허용, R14)
                else completed true → false
                    SV->>SV: completedAt 비움
                end
                SV->>DB: BEGIN (withTransaction)
                SV->>RP: todos UPDATE
                RP->>DB: UPDATE todos
                opt 공유 팀 변경이 있음
                    SV->>RP: todo_shares 추가, 삭제
                    RP->>DB: INSERT, DELETE todo_shares
                end
                opt FR-10 구현 후 (P1)
                    SV->>DM: 필드별 이전 값과 새 값 계산, action 결정 (완료 여부가 바뀌면 COMPLETED 또는 UNCOMPLETED, 아니면 UPDATED. 함께 바뀐 필드도 모두 changes에 포함)
                    SV->>RP: todo_histories INSERT (요청 1건에 1건, 변경자 = 요청자, 소유자와 다를 수 있음)
                    RP->>DB: INSERT todo_histories
                end
                alt 어느 쓰기든 실패
                    SV->>DB: ROLLBACK (변경도 이력도 남지 않음, EX-33)
                    SV-->>FE: 500 INTERNAL_ERROR
                else 성공
                    SV->>DB: COMMIT
                    SV->>SV: 응답 생성 (canEdit, isOwner, 비소유자 응답에서 카테고리 제거)
                    SV-->>FE: 수정된 할일
                end
            end
            FE->>U: 관련 목록, 캘린더 재조회 (invalidate)
        end
    end
    Note over SV,DB: 어느 경로든 finally에서 client.release()
```

### 5.5 목록·캘린더 조회: 권한·필터·상태 계산

근거: 상태(S1–S4)는 저장하지 않고 조회 시 SQL로 계산해 필터와 정렬에 쓰고, 그 뒤에 페이지네이션한다(FR-05 #6, 도메인 §5.1, OPS-17). 권한 조건(R2, R21)은 처음부터 쿼리에 넣고, 다른 사람 할일 응답에서는 카테고리를 제거한다(SEC-06). 현재 시각은 서버 시각을 분 단위로 자른다(R5, OPS-14). 캘린더는 최대 42일, 500건 상한과 `truncated` 표시가 있다(OPS-16).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant FE as SC-03, SC-05 (TanStack Query, Zustand)
    participant RT as todos.routes
    participant SV as todos.service
    participant DM as domain todo-status
    participant RP as todos.repo, access.js
    participant DB as PostgreSQL

    U->>FE: 필터 변경 또는 캘린더 이동
    FE->>FE: Zustand 필터, 뷰 상태를 쿼리 파라미터로 변환
    Note over FE,RT: F4 사용자 선택지는 GET /api/teams/:teamId/members 를 내가 속한 팀마다 재사용 (teams.routes)
    FE->>RT: 목록 GET /api/todos (보기 F4, 카테고리 F2, 상태 F1, limit, offset), 캘린더 GET /api/todos?from=&to= (보기 F4, 기간)
    RT->>RT: 파라미터를 허용 목록으로 검증 (정렬, 상태, 역할 열거값)
    alt 허용되지 않은 값
        RT-->>FE: 400 VALIDATION_ERROR
    else 통과
        RT->>SV: list 또는 calendar
        SV->>SV: 현재 시각 = 서버 시각 (분 단위 절삭), 클라이언트 시계는 쓰지 않음
        opt 캘린더 조회
            alt 기간이 42일 초과
                SV-->>FE: 400 VALIDATION_ERROR (42일 초과 기간)
            end
        end
        SV->>RP: 조회 (필터와 권한을 한 쿼리로)
        RP->>DB: SELECT 권한 WHERE (내 할일 또는 내가 속한 팀에 공유된 할일) AND F4 AND F2 AND F1 상태 CASE (S1 → S2 → S3 → S4 순)
        Note over RP,DB: 공유 팀은 JOIN 또는 집계로 함께 조회 (N+1 금지), 보는 사람이 속한 팀만
        alt 목록
            RP->>DB: 시작 일시 오름차순, LIMIT 기본 50 최대 100, OFFSET, 필터 적용 후 total
        else 캘린더
            RP->>DB: 뷰 범위와 하루라도 겹치는 할일 (R15), 최대 500건
        end
        DB-->>RP: 행
        loop 각 행
            SV->>DM: 상태 판정 (completed, startAt, endAt, 현재 시각)
            SV->>SV: canEdit, isOwner 계산
            opt 소유자가 요청자가 아님
                SV->>SV: 카테고리 필드 제거 (SEC-06)
            end
        end
        opt 캘린더 결과가 상한 500건에 도달
            SV->>SV: truncated true
        end
        SV-->>FE: 목록과 total 또는 캘린더 결과와 truncated
        FE->>U: 상태 배지는 서버 status 그대로 표시, 상한 도달 시 안내 띠
    end
    opt 풀 연결 대기 5초 초과 등 서버 오류
        SV-->>FE: 500 INTERNAL_ERROR (ST-04, 이미 보인 데이터는 유지)
    end
```

### 5.6 카테고리 삭제: 할일을 기본 카테고리로 이동

근거: 기본 카테고리는 삭제할 수 없고(R8, FR-02 #4), 삭제하는 카테고리의 할일은 삭제하지 않고 기본 카테고리로 옮긴다. 할일 수는 변하지 않아야 하므로 이동과 삭제는 한 트랜잭션이다(R9, FR-02 #5, BE-08). 확인 대화상자에서 취소하면 아무것도 바뀌지 않는다(C-04, DLG-02).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant FE as CategoriesPage SC-06
    participant RT as categories.routes
    participant SV as categories.service
    participant RP as categories.repo, todos.repo
    participant DB as PostgreSQL

    U->>FE: 삭제 선택
    FE->>U: DLG-02 확인 (이 카테고리의 할일은 기본으로 옮겨집니다)
    alt 취소
        U-->>FE: 취소 (요청 없음, 아무것도 바뀌지 않음)
    else 확인
        FE->>RT: DELETE /api/categories/:categoryId
        RT->>SV: remove
        SV->>RP: 본인 카테고리 조회 (소유자 조건)
        alt 없거나 다른 사람 카테고리
            SV-->>FE: 404 NOT_FOUND
        else 본인 카테고리
            alt isDefault true
                SV-->>FE: 403 DEFAULT_CATEGORY_PROTECTED
            else 일반 카테고리
                SV->>DB: BEGIN (withTransaction)
                SV->>RP: 소유자의 기본 카테고리 조회
                SV->>RP: 이 카테고리의 모든 할일을 기본 카테고리로 UPDATE
                RP->>DB: UPDATE todos
                Note over SV,DB: 다른 구성원의 관리자가 대신 만든 할일도 소유자의 기본 카테고리이므로 영향 없음
                Note over SV,DB: 할일 이동은 사용자의 할일 수정 요청이 아니므로 todo_histories를 남기지 않음 (R20, ERD E-14)
                SV->>RP: 카테고리 DELETE
                RP->>DB: DELETE categories
                alt 이동 또는 삭제 실패
                    SV->>DB: ROLLBACK (할일 수 불변)
                    SV-->>FE: 500 INTERNAL_ERROR
                else 성공
                    SV->>DB: COMMIT
                    SV-->>FE: 성공
                    FE->>U: 카테고리 목록과 할일 목록 재조회
                end
            end
        end
    end
```

### 5.7 팀 구성원 추가·제거와 공유 해제

근거: 구성원 추가·제거와 관리자 지정·해제는 소유자만 하며(R18, EX-28), 추가는 이메일로 즉시 이뤄지고 역할을 고르지 않으면 `MEMBER`다(C-10). 구성원을 제거하면 그 사람 할일의 그 팀 공유가 함께 해제되어야 하므로 한 트랜잭션이다(R21, FR-11 #5, BE-08). 역할은 JWT가 아니라 요청마다 DB로 확인하므로 변경이 바로 반영된다(SEC-03, US-15 #2). 소유자의 자기 제거는 구성원 제거 경로가 아니라 5.8의 팀 나가기로만 처리하므로 제거 경로에 자기 자신을 지정하면 400 `VALIDATION_ERROR`다(EX-29, N-11). `todo_shares` 정리는 FK 연쇄가 아니라 service가 같은 트랜잭션에서 직접 `DELETE`한다(OPS-23).

```mermaid
sequenceDiagram
    autonumber
    actor O as 팀 소유자
    participant FE as TeamDetailPage SC-09
    participant RT as teams.routes
    participant SV as teams.service
    participant RP as teams.repo, todos.repo
    participant DB as PostgreSQL

    O->>FE: 구성원 추가, 제거, 관리자 지정 또는 해제
    FE->>RT: 추가 POST /api/teams/:teamId/members, 역할 변경 PATCH /api/teams/:teamId/members/:userId, 제거 DELETE /api/teams/:teamId/members/:userId
    RT->>SV: 팀 관리 유스케이스
    SV->>RP: 요청자의 그 팀 역할 조회 (매 요청 DB 확인)
    alt 그 팀 구성원이 아님
        SV-->>FE: 404 NOT_FOUND (ST-02)
    else 구성원이지만 OWNER가 아님
        SV-->>FE: 403 FORBIDDEN
    else OWNER
        alt 구성원 추가
            SV->>SV: 이메일 앞뒤 공백 제거, 소문자 정규화, 역할 미지정이면 MEMBER
            SV->>RP: 이메일로 사용자 조회
            alt 가입하지 않은 이메일
                SV-->>FE: 404 USER_NOT_FOUND
            else 이미 그 팀 구성원
                SV-->>FE: 409 ALREADY_MEMBER
            else 추가 가능
                SV->>RP: team_members INSERT (수락 절차 없이 즉시)
                RP->>DB: INSERT team_members
                SV-->>FE: 성공 (구성원 표 갱신)
            end
        else 관리자 지정 또는 해제
            SV->>RP: 대상 역할을 MANAGER 또는 MEMBER로 UPDATE
            RP->>DB: UPDATE team_members
            Note over SV,DB: 역할 변경은 MANAGER와 MEMBER 사이만이다. OWNER로의 승격은 5.8 팀 나가기에서만 일어난다
            SV-->>FE: 성공 (확인 대화상자 없음, 다음 요청부터 즉시 반영)
        else 구성원 제거
            FE->>O: DLG-05 확인 (공유가 해제됩니다)
            alt 대상이 요청자 자신 (소유자의 자기 제거)
                SV-->>FE: 400 VALIDATION_ERROR (자기 제거는 5.8의 POST /api/teams/:teamId/leave로만 처리)
            else 다른 구성원
                SV->>DB: BEGIN (withTransaction)
                SV->>RP: team_members DELETE
                RP->>DB: DELETE team_members
                SV->>RP: 대상 소유 할일 중 이 팀의 todo_shares 직접 DELETE (FK 연쇄 아님, 같은 트랜잭션)
                RP->>DB: DELETE todo_shares
                alt 어느 쓰기든 실패
                    SV->>DB: ROLLBACK (구성원도 공유도 그대로)
                    SV-->>FE: 500 INTERNAL_ERROR
                else 성공
                    SV->>DB: COMMIT
                    SV-->>FE: 성공
                    Note over SV,DB: 제거된 사람의 다른 사람 할일 열람과 관리 권한은 다음 요청부터 사라짐 (403 또는 404)
                end
            end
        end
    end
```

### 5.8 소유자의 팀 나가기: 다음 소유자 지정 (P1)

근거: 팀당 소유자는 정확히 1명이라 소유자는 다음 소유자를 지정해야만 나갈 수 있고, 소유자 지정·나가기·공유 해제는 한 번에 처리한다(R18, R21, FR-09 #12, C-11). 다른 구성원이 없으면 나갈 수 없다(EX-36). 검사 순서는 구성원 아님(404) → 소유자 아님(403) → 다른 구성원 없음(`NO_NEXT_OWNER`) → 다음 소유자 미지정(`OWNER_MUST_TRANSFER`) → 지정한 사람이 그 팀의 다른 구성원이 아님(400 `INVALID_OWNER`)이다(EX-29, EX-36, EX-40, EX-41). 소유자가 아닌 구성원의 팀 나가기는 범위 밖이라 화면에는 버튼이 없고, API로 요청하면 403이다(도메인 §7). 팀당 `OWNER`는 부분 유니크 인덱스로 1명만 허용되므로 기존 소유자를 먼저 삭제한 뒤 새 소유자를 승격한다(도메인 §3.9, OPS-23).

```mermaid
sequenceDiagram
    autonumber
    actor O as 팀 소유자
    participant FE as TeamDetailPage SC-09
    participant RT as teams.routes
    participant SV as teams.service
    participant RP as teams.repo, todos.repo
    participant DB as PostgreSQL

    O->>FE: 팀 나가기 선택
    FE->>O: DLG-04 다음 소유자 선택 (선택지는 나를 뺀 구성원, 없으면 확인 버튼 비활성)
    O->>FE: 다음 소유자 선택 후 확인
    FE->>RT: POST /api/teams/:teamId/leave (다음 소유자)
    RT->>SV: leave
    SV->>RP: 요청자의 그 팀 역할 조회
    alt 그 팀 구성원이 아님
        SV-->>FE: 404 NOT_FOUND
    else OWNER가 아님
        SV-->>FE: 403 FORBIDDEN (화면에서는 소유자가 아니면 나가기 버튼이 없음)
    else OWNER
        SV->>RP: 나를 뺀 구성원 조회
        alt 다른 구성원이 없음
            SV-->>FE: 409 NO_NEXT_OWNER
        else 다음 소유자 미지정
            SV-->>FE: 409 OWNER_MUST_TRANSFER
        else 지정한 사람이 그 팀의 다른 구성원이 아님
            SV-->>FE: 400 INVALID_OWNER
        else 지정이 유효함
            SV->>DB: BEGIN (withTransaction)
            SV->>RP: 나(기존 소유자)를 team_members에서 먼저 DELETE
            RP->>DB: DELETE team_members
            SV->>RP: 다음 소유자 role을 OWNER로 UPDATE (기존 소유자를 뺀 뒤 승격)
            RP->>DB: UPDATE team_members
            Note over SV,DB: 팀당 OWNER 1명 부분 유니크 인덱스 때문에 승격을 먼저 하면 인덱스 위반
            SV->>RP: 내 할일 중 이 팀의 todo_shares 직접 DELETE (FK 연쇄 아님)
            RP->>DB: DELETE todo_shares
            alt 어느 쓰기든 실패
                SV->>DB: ROLLBACK (소유자는 그대로, 팀당 OWNER 1명 유지)
                SV-->>FE: 500 INTERNAL_ERROR
            else 성공
                SV->>DB: COMMIT
                SV-->>FE: 성공
                FE->>O: SC-08로 이동 (그 팀은 목록에서 사라짐)
            end
        end
    end
```

### 5.9 변경 이력 조회: 보는 사람별 필터링 (P1)

근거: 이력은 그 할일을 볼 수 있는 사용자가 볼 수 있지만, 카테고리 변경은 소유자에게만, 공유 팀 변경은 보는 사람이 속한 팀만 보인다. 이렇게 걸러서 남는 변경이 없는 이력은 숨긴다(R20, R21, C-17, FR-10 #4·#6, US-17). 이력의 수정·삭제 API는 없다(FR-10 #3).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자 (소유자, 관리자, 일반 팀원)
    participant FE as TodoEditPage SC-04 이력 탭
    participant RT as todo-histories.routes
    participant SV as todo-histories.service
    participant TS as todos.service
    participant DM as domain history-diff
    participant RP as todo-histories.repo
    participant DB as PostgreSQL

    U->>FE: 변경 이력 탭 선택
    FE->>RT: GET /api/todos/:todoId/histories
    RT->>SV: list
    SV->>TS: 요청자가 볼 수 있는 할일인지 확인 (BE-06, 다른 모듈은 service로만)
    alt 볼 수 없거나 없음
        TS-->>SV: 없음
        SV-->>FE: 404 NOT_FOUND
    else 볼 수 있음
        SV->>RP: 이력 조회 (변경 일시 최신순)
        RP->>DB: SELECT todo_histories
        SV->>RP: 요청자가 속한 팀 목록 조회
        loop 각 이력 행
            SV->>DM: 보는 사람 기준으로 변경 내용 필터링
            alt 요청자가 할일 소유자가 아님
                DM->>DM: 카테고리 변경 필드 제거 (CREATED의 처음 값 포함)
            end
            DM->>DM: 공유 팀 변경 중 요청자가 속한 팀만 남김
            alt 남은 변경 내용이 없음
                DM-->>SV: 이 이력은 숨김
            else 남은 변경이 있음
                DM-->>SV: 걸러낸 이력
            end
        end
        SV-->>FE: 걸러낸 이력 목록
        alt 표시할 이력이 없음
            FE->>U: 표시할 변경 이력이 없습니다
        else 있음
            FE->>U: 일시, 사용자, 동작 (등록, 수정, 완료, 완료 해제)과 필드별 이전값 → 새값
        end
    end
```

### 5.10 토큰 갱신·로그아웃: 리프레시 토큰 회전과 폐기

근거: 액세스 토큰은 15분, 리프레시 토큰은 7일 절대 만료이고 DB에는 해시만 저장한다(PRD §5.2 A25). 보호 API가 401을 주면 클라이언트가 한 번 갱신한 뒤 원래 요청을 다시 보낸다(OPS-10, EX-42). 갱신마다 쓴 토큰을 폐기하고 새 토큰을 주며(회전), 폐기된 토큰이 다시 오면 그 사용자의 리프레시 토큰을 모두 폐기한다(SEC-02, EX-43). 폐기와 발급은 한 트랜잭션이고, 조건부 `UPDATE … RETURNING`으로 같은 토큰의 동시 갱신 중 하나만 성공한다. 만료 행 정리는 앱이 아니라 `pg_cron`이 한다(OPS-24).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant CL as 브라우저 shared/api/client.ts
    participant RT as auth.routes
    participant SV as auth.service
    participant RP as auth.repo
    participant DB as PostgreSQL

    U->>CL: 화면 조작
    CL->>RT: 보호 API 요청 (access_token 만료)
    RT-->>CL: 401 UNAUTHENTICATED (authenticate)
    Note over CL: 동시에 받은 401은 갱신 요청 하나로 합친다
    CL->>RT: POST /api/auth/refresh (쿠키 refresh_token, Path=/api/auth)
    RT->>SV: refresh
    SV->>DB: BEGIN (withTransaction)
    SV->>RP: 해시로 폐기 UPDATE (revoked_at 없음, 만료 전 조건) RETURNING
    alt 1행 (유효)
        SV->>RP: 새 리프레시 토큰 해시 INSERT (기존 expires_at 유지)
        SV->>DB: COMMIT
        SV-->>RT: 사용자 ID
        RT-->>CL: Set-Cookie access_token (HS384, 15분), refresh_token
        CL->>RT: 원래 요청 1회 재시도
    else 0행, 해시가 이미 폐기된 토큰 (재사용)
        SV->>RP: 그 사용자의 유효한 리프레시 토큰 전부 폐기
        SV->>DB: COMMIT
        SV-->>RT: AppError 401 UNAUTHENTICATED
        RT-->>CL: 401, 쿠키 2개 삭제
        CL->>U: ST-01 로그인 화면으로 이동
    else 0행, 없거나 만료
        SV->>DB: ROLLBACK
        RT-->>CL: 401, 쿠키 2개 삭제
        CL->>U: ST-01 로그인 화면으로 이동
    end
    opt 로그아웃
        U->>CL: 로그아웃 버튼
        CL->>RT: POST /api/auth/logout (공개 경로)
        RT->>SV: 쿠키의 리프레시 토큰 폐기 (있으면)
        RT-->>CL: 쿠키 2개 삭제
        CL->>U: SC-01로 이동
    end
    Note over SV,DB: 어느 경로든 finally에서 client.release()
```

### 5.11 Google 소셜 로그인: state 검증과 계정 결정

근거: 백엔드 주도 Authorization Code + state 흐름이고 제공자 설정은 `oauth.providers.js` 하나다(PRD §5.2 소셜 로그인, SEC-13). 계정 결정은 `oauthLogin` 한 곳이다(도메인 R22). 시작·콜백은 브라우저가 이동하는 공개 경로라 JSON이 아니라 302로 응답한다(N-11).

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant BR as 브라우저
    participant RT as auth.routes
    participant PV as oauth.providers
    participant GG as Google
    participant SV as auth.service
    participant DB as PostgreSQL

    U->>BR: 'Google로 계속하기' (링크 이동, next 포함)
    BR->>RT: GET /api/auth/oauth/google?next=...
    RT->>PV: getProvider (키 없거나 알 수 없는 제공자면 404 NOT_FOUND)
    RT->>RT: state 32바이트 생성, next 검증(내부 경로만, 아니면 /)
    RT-->>BR: Set-Cookie oauth_state (10분, Lax) + 302 Google 인가 URL
    BR->>GG: 로그인·동의
    GG-->>BR: 302 /api/auth/oauth/google/callback?code&state
    BR->>RT: GET callback (쿠키 oauth_state)
    RT->>RT: oauth_state 쿠키 삭제, state 상수 시간 비교
    alt code 없음 또는 state 불일치
        RT-->>BR: 302 {APP_URL}/login?error=OAUTH_FAILED
    else 일치
        RT->>PV: fetchProfile(code)
        PV->>GG: 토큰 교환 (client_secret, 10초 제한)
        GG-->>PV: access_token
        PV->>GG: userinfo
        GG-->>PV: sub, email, email_verified, name
        RT->>SV: oauthLogin(google, 프로필)
        SV->>DB: BEGIN (withTransaction)
        SV->>DB: (provider, sub)로 소셜 계정 연결 조회
        alt 연결 있음 (R22 ①)
            SV->>DB: 그 사용자로 리프레시 토큰 INSERT
        else 연결 없음, 이메일 없음 또는 미확인 (R22 ④)
            SV->>DB: ROLLBACK
            RT-->>BR: 302 {APP_URL}/login?error=OAUTH_EMAIL_REQUIRED
        else 연결 없음, 같은 이메일 사용자 있음 (R22 ② 자동 연결)
            SV->>DB: user_identities INSERT, 리프레시 토큰 INSERT
        else 연결도 사용자도 없음 (R22 ③)
            SV->>DB: users INSERT (password_hash NULL), 기본 카테고리 INSERT, user_identities INSERT, 리프레시 토큰 INSERT
        end
        SV->>DB: COMMIT
        Note over SV,DB: 동시 가입으로 이메일·identity 유일 충돌(23505)이면 1회 다시 시도
        SV-->>RT: 토큰 2종
        RT-->>BR: Set-Cookie access_token, refresh_token + 302 {APP_URL}{next}
    end
    Note over RT,BR: 그 밖의 예외는 서버 로그에 남기고 302 /login?error=OAUTH_FAILED
```

## 6. 확인 필요 사항

T-01–T-08은 모두 이해관계자 확인(2026-11-04)으로 결정해 기준 문서에 반영했다. 남은 확인 필요 사항은 없다. 각 항목의 원래 문제 뒤에 결정 내용을 적었다.

### 6.1 문서 간 불일치

| ID | 내용 | 관련 문서·위치 |
|----|------|----------------|
| T-01 | **결정됨 — 반영 문서 도메인 v0.12, 와이어프레임 v0.7.** 와이어프레임 이력 탭이 '(탈퇴한 사용자)', '(삭제된 팀)' 표시를 정의하는데, 회원 탈퇴와 팀 삭제는 범위 밖이라 그 상태가 생기지 않는다. 사용자·팀 삭제 시 `TodoHistory`의 `actorId`, `TodoShare`의 `teamId` 참조 처리도 정해져 있지 않다. 결정: 두 표시를 삭제한다. 사용자·팀을 참조하는 FK는 `ON DELETE RESTRICT`다 | 와이어프레임 §4.5.4(U-16) / 도메인 §7, PRD §3.2 / 도메인 §3.9, 프로젝트 원칙 OPS-23 |
| T-02 | **결정됨 — 반영 문서 도메인 v0.12, PRD v0.11, 사용자 시나리오 v0.9, 와이어프레임 v0.7, 프로젝트 원칙 v0.7, 이 문서 v0.2.** 비밀번호 상한 표현이 달랐다(도메인 3.4와 PRD '8–72자', 시나리오 6.3과 SEC-09는 바이트 기준). 결정: '8자 이상, UTF-8 72바이트 이하'로 통일한다 | 도메인 §3.4 / PRD FR-01 #3, §5.2 / 시나리오 §6.3 / 프로젝트 원칙 SEC-01, SEC-09 |

### 6.2 문서에 없어 그림에서 정하지 못한 항목

| ID | 내용 | 영향 흐름 |
|----|------|-----------|
| T-03 | **결정됨 — 반영 문서 도메인 v0.12, PRD v0.11, 사용자 시나리오 v0.9, 와이어프레임 v0.7, 이 문서 v0.2.** 관리자가 구성원 할일을 대리 등록할 때 R4의 '오늘'과 일시 기본값에 쓰는 시간대. 결정: 요청자(인증된 사용자)의 `User.timezone` 기준이다(소유자의 시간대가 아님) | 5.3 |
| T-04 | **결정됨 — 반영 문서 도메인 v0.12, PRD v0.11, 사용자 시나리오 v0.9, 프로젝트 원칙 v0.7, 이 문서 v0.2.** 완료 여부와 다른 필드를 한 번에 바꾼 요청의 이력 `action`과 건수. 결정: 요청 1건 = 이력 1건이다. 완료 여부가 바뀌면 `COMPLETED`/`UNCOMPLETED`, 아니면 `UPDATED`이고, 함께 바뀐 필드는 모두 `changes`에 포함한다 | 5.4 |
| T-05 | **결정됨 — 반영 문서 PRD v0.11, 사용자 시나리오 v0.9, 와이어프레임 v0.7, 프로젝트 원칙 v0.7, 이 문서 v0.2.** 오류 코드가 시나리오 6.2에 없던 거부 사례. 결정: ① 일반 팀원(관리자 아님)이 다른 사람을 소유자로 지정 → 403 `FORBIDDEN` ② 42일을 넘는 캘린더 기간 → 400 `VALIDATION_ERROR` ③ 소유자가 아닌 구성원의 팀 나가기 → 403 `FORBIDDEN`(UI는 비소유자에게 나가기 버튼을 숨김) ④ 다음 소유자로 지정한 사람이 그 팀의 다른 구성원이 아님 → 400 `INVALID_OWNER` | 5.3, 5.5, 5.8 |
| T-06 | **결정됨 — 반영 문서 도메인 v0.12, PRD v0.11, 사용자 시나리오 v0.9, 와이어프레임 v0.7, 프로젝트 원칙 v0.7, 이 문서 v0.2.** 팀 나가기 검사 순서와 EX-29의 '자기 자신 제거' 경로. 결정: 검사 순서는 `NO_NEXT_OWNER`(다른 구성원 없음) → `OWNER_MUST_TRANSFER`(다음 소유자 미지정)이다. 자기 제거는 `POST /api/teams/:teamId/leave`로만 처리하고, 구성원 제거 API로 자기 자신을 지정하면 400 `VALIDATION_ERROR`다. 5.7의 `OWNER_MUST_TRANSFER` 분기는 이 규칙으로 바꿨다 | 5.7, 5.8 |
| T-07 | **결정됨 — 반영 문서 프로젝트 원칙 v0.7, 이 문서 v0.2.** API 경로 미정의. 결정: 프로젝트 원칙 N-11에 캘린더 조회 `GET /api/todos?from=&to=`(목록 API의 기간 필터), F4 사용자 선택지 `GET /api/teams/:teamId/members`(기존 재사용), `/api/categories`, `/api/categories/:categoryId`, 구성원 제거 `DELETE /api/teams/:teamId/members/:userId`, 역할 변경 `PATCH /api/teams/:teamId/members/:userId`를 추가했다. 이 문서의 서술형·유추 경로를 이 경로로 교체했다 | 5.4–5.8 |
| T-08 | **결정됨 — 반영 문서 도메인 v0.12, 프로젝트 원칙 v0.7, 이 문서 v0.2.** 삭제 방식과 팀당 OWNER 1명 보장 방식. 결정: 할일 삭제 시 이력·공유는 FK `ON DELETE CASCADE`, 구성원 제거 시 공유 해제는 service가 같은 트랜잭션에서 직접 `DELETE`, 팀당 OWNER 1명은 부분 유니크 인덱스 `UNIQUE (team_id) WHERE role = 'OWNER'`다. 그래서 소유권 이전은 기존 소유자 삭제(강등) → 새 소유자 승격 순서이며 5.8을 고쳤다 | 5.4, 5.7, 5.8 |

## 7. 변경 이력

| 버전 | 일자 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| v0.1 | 2026-11-04 | hjining | 최초 작성 (도메인 정의서 v0.11, PRD v0.10, 사용자 시나리오 v0.8, 와이어프레임 v0.6, 프로젝트 구조 설계 원칙 v0.6 기반). 시스템 아키텍처, 계층·모듈 구조(3종), 엔티티 관계, 복잡한 비즈니스 로직 시퀀스 9종, 확인 필요 사항 T-01–T-08 |
| v0.2 | 2026-11-04 | hjining | 확인 필요 T-01–T-08 결정 반영(6장을 '결정됨'으로 갱신, 기준 문서 버전 갱신). 시퀀스 수정: 5.3 일반 팀원의 소유자 지정 403·대리 등록 시간대, 5.4 이력 action 결정·CASCADE, 5.5 경로(`GET /api/todos?from=&to=`)·42일 초과 400, 5.7 경로 구체화·자기 제거 400·공유 직접 삭제·역할 변경 범위, 5.8 비소유자 403·INVALID_OWNER·기존 소유자 삭제 후 승격 순서. 4장 ER 주석에 FK RESTRICT/CASCADE·부분 유니크 인덱스 추가, 5.2 비밀번호 길이 표기 |
| v0.3 | 2026-11-04 | hjining | 기준 문서 버전 갱신(사용자 시나리오 v0.10, 와이어프레임 v0.8, 프로젝트 원칙 v0.8). 5.2 비밀번호는 공백 제거 없이 검사(시나리오 C-23) |
| v0.4 | 2026-11-04 | hjining | 기준 문서 버전 갱신(도메인 v0.13, PRD v0.12, 사용자 시나리오 v0.11, 와이어프레임 v0.9, 프로젝트 원칙 v0.9). 5.6에 카테고리 삭제 이동은 이력을 남기지 않는다는 Note 추가(ERD E-14). 4장의 erDiagram과 FK·인덱스 주석을 `docs/7-erd.md`로 분리하고 4장은 링크만 남김. 1.2 다이어그램 목록 4행 수정 |
| v0.5 | 2026-11-04 | hjining | 기준 문서 버전 갱신(PRD v0.13, 사용자 시나리오 v0.12, 와이어프레임 v0.10, 프로젝트 원칙 v0.10). PRD A25–A27 반영: 2장 인증 설명과 `pg_cron` 노드, 5.1 401 분기에 갱신·재시도와 `HS384`·15분, 5.2 가입 응답 쿠키 2종과 리프레시 토큰 INSERT, 5.10 토큰 갱신·로그아웃 시퀀스 추가(1.2, 5.0 목록) |
| v0.6 | 2026-11-04 | hjining | 기준 문서 버전 갱신(PRD v0.14, 사용자 시나리오 v0.13, 와이어프레임 v0.11, 프로젝트 원칙 v0.11). 5.1 공개 경로를 SEC-04와 맞춤(refresh, logout, health 추가). 5.3 등록 시퀀스의 일시 형식 검증에 날짜만 보낸 값 예외(SEC-11) 표시 |
| v0.7 | 2026-11-05 | hjining | 기준 문서 버전 갱신(프로젝트 원칙 v0.12). 다이어그램 변경 없음 |
| v0.8 | 2026-11-05 | hjining | 기준 문서 버전 갱신(프로젝트 원칙 v0.13). 다이어그램 변경 없음. 기준 문서 버전 갱신(PRD v0.15, 사용자 시나리오 v0.14, 와이어프레임 v0.12). 2장 다이어그램: 프론트 → API 호출을 CORS(`VITE_API_BASE_URL`, `credentials: include`)로, 환경변수에 `CORS_ORIGINS` |
| v0.9 | 2026-11-05 | hjining | 문서 정합성 검토: 기준 문서 버전 갱신(도메인 v0.14, PRD v0.16, 사용자 시나리오 v0.15, 와이어프레임 v0.14, 프로젝트 원칙 v0.15). 제목 줄에 잘못 들어간 문구 제거(내용은 v0.8 이력에 있음). 5.0 단순 CRUD 목록에 내 캘린더 팀 색 변경(PRD A29) 추가. 다이어그램 변경 없음 |
| v0.10 | 2026-11-05 | hjining | 다국어·테마·Google 소셜 로그인 반영(DOC-01), 기준 문서 버전 갱신(도메인 v0.14, PRD v0.16, 사용자 시나리오 v0.15, 와이어프레임 v0.14, 프로젝트 원칙 v0.16): 2장 외부 인증 서비스를 Google OAuth로 정정(소셜 로그인 범위 밖 문구 수정)하고 다이어그램에 Google 노드·i18n/테마 노드·환경변수 추가, 5.1 공개 경로에 oauth, 5.11 Google 소셜 로그인 시퀀스 추가(1.2, 5.0 목록). 2장에 프론트 개발 모드 전용 콘솔 로깅 설명 추가(프로젝트 원칙 OPS-25). 다이어그램 변경 없음 |
| v0.11 | 2026-11-06 | hjining | 문서 정합성 검토: 기준 문서 버전 갱신(도메인 v0.15, PRD v0.17, 사용자 시나리오 v0.16, 와이어프레임 v0.15, 프로젝트 원칙 v0.17). 내용·다이어그램 변경 없음 |
