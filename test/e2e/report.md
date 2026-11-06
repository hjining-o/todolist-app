# E2E 통합 테스트 리포트

| 항목 | 내용 |
|------|------|
| 실행일 | 2026-11-06 (KST 09:47–09:58) |
| 기준 문서 | `docs/3-user-scenario.md` v0.16 |
| 도구 | Playwright MCP (Chromium) + curl(API 직접 호출 케이스) |
| 대상 | 프론트엔드 개발 서버 `http://localhost:5173`, 백엔드 개발 서버 `http://localhost:3000` |
| 뷰포트 | 데스크톱 1280×800, 모바일 390×844 |
| 테스트 계정 | `e2e-{a,b,c,d}-11060947@example.com` (A=마케팅팀 소유자, B=관리자, C=일반 팀원·Sales팀 팀원, D=Sales팀 소유자) |
| 팀 | `마케팅팀-11060947`(A), `Sales-11060947`(D), `Solo-11060947`(B, EX-36용) |

> 오늘이 2026-11-06이라 문서 예시 날짜(11/04)를 실행일 기준으로 바꿔 검증했다. 테스트 데이터는 개발 DB에 남아 있다.

## 1. 요약

| 구분 | 수행 | 통과 | 실패 | 미수행 |
|------|-----:|-----:|-----:|-----:|
| 정상 흐름 (US) | 20 | 20 | 0 | 2 (US-19, US-20) |
| 예외·경계 (EX) | 41 | 41 | 0 | 8 |

- **결함 1건 (Minor) → 수정·재테스트 완료**: 시작 = 종료 = 23:59인 할일이 데스크톱 캘린더에서 다음 날까지 이어져 그려지던 문제 (아래 3.1).
- **관찰 2건**: 개발 모드 콘솔 오류, 관리자 대리 등록 화면에서 공유 팀 필드가 보이지 않음 (아래 3.2, 3.3).
- API 직접 호출 결과 전체: [`api-checks.log`](api-checks.log)

## 2. 시나리오별 결과

### 2.1 정상 흐름

| ID | 시나리오 | 결과 | 확인 내용 | 스크린샷 |
|----|----------|:---:|-----------|----------|
| US-01 | 가입 → 첫 할일 → 목록 | ✅ | 가입 직후 `/todos` 자동 이동. 등록 화면 '팀'=없음(개인), 카테고리=기본. 제목만 저장 시 `11-06 00:00 ~ 23:59`, '진행 중' | ![](screenshots/us01-after-signup-list.png) ![](screenshots/us01-todo-new-form.png) ![](screenshots/us01-first-todo-list.png) |
| US-02 | 로그인·로그아웃 | ✅ | `E2E-B-…@Example.COM` 대문자 이메일 로그인 성공. 로그아웃 후 `/todos` 접근 → `/login?next=%2Ftodos` | ![](screenshots/01-login.png) ![](screenshots/us02-protected-redirect.png) |
| US-03 | 카테고리 관리 | ✅ | Work·임시 추가 → '스터디'로 이름 변경 → 할일 2건 지정 → 삭제 확인 대화상자(취소 시 유지) → 삭제 후 할일 2건이 '기본'으로 이동. '기본' 행 수정·삭제 비활성 | ![](screenshots/us03-category-delete-confirm.png) ![](screenshots/us03-categories-after-delete.png) |
| US-04 | 할일 등록 (일시 지정) | ✅ | 분기 기획안 11/10 09:00~23:59 '시작 전' / 견적서 제출 종료만 → 시작 11/06 00:00 '진행 중' / 팀 회의 시작=종료 14:00 허용 | ![](screenshots/us04-todo-list-statuses.png) |
| US-05 | 할일 수정 | ✅ | 제목·종료 변경 시 카테고리 Work 유지, 이후 카테고리 기본으로 변경 | ![](screenshots/us05-todo-edit.png) |
| US-06 | 완료·해제 | ✅ | 목록 체크 → '완료', 해제 → '시작 전' 복귀, 편집 화면 완료 체크도 동작 | ![](screenshots/us06-completed-in-list.png) |
| US-07 | 할일 삭제 | ✅ | 확인 대화상자 취소 시 유지, 확인 시 삭제. 같은 ID 재접근 → '찾을 수 없습니다.'(API 404) | ![](screenshots/us07-delete-confirm.png) ![](screenshots/us07-deleted-todo-notfound.png) |
| US-08 | 목록 필터 | ✅ | 진행 중 / 진행 중+Work(AND) / 기한 초과 / 완료 / 시작 전 필터 결과 정확. 결과 없음 화면, 필터 초기화. F4 선택지 = 팀 전체·내 할일·마케팅팀·B·C (D 없음) | ![](screenshots/us08-filter-status-category.png) ![](screenshots/us08-filter-empty.png) |
| US-09 | 캘린더 월·주·일 | ✅ | 월 뷰 다일 막대, 주 뷰 11/01(일)–11/07(토), 일 뷰 11/06 겹치는 할일 모두 표시, 이전/다음/오늘, F4=마케팅팀, 내 캘린더 색상 청록(TEAL) 반영 | ![](screenshots/us09-calendar-month.png) ![](screenshots/us09-calendar-week.png) ![](screenshots/us09-calendar-day.png) ![](screenshots/us09-team-color-teal.png) ![](screenshots/us09-calendar-team-filter.png) |
| US-10 | 모바일 레이아웃 | ✅ | 햄버거 메뉴(언어·테마·로그아웃 포함), 목록 단일 열·필터 접힘, 월 뷰 날짜 칸 개수 표시, 날짜 탭 → 일 뷰 | ![](screenshots/us10-mobile-list.png) ![](screenshots/us10-mobile-hamburger.png) ![](screenshots/us10-mobile-filter-open.png) ![](screenshots/us10-mobile-calendar-month.png) ![](screenshots/us10-mobile-day-view.png) |
| US-11 | 팀 생성·구성원·관리자 | ✅ | A=소유자, B 관리자로 추가, C 역할 미선택 → 일반 팀원, B 관리자 해제/재지정 | ![](screenshots/us11-teams-empty.png) ![](screenshots/us11-team-detail-members.png) |
| US-12 | 팀 공유 할일 | ✅ | F4=마케팅팀 상태에서 등록 → 팀 기본값 마케팅팀. B 목록에 표시·카테고리 '(없음)'. C는 팀 선택지 2개(본인 팀만), 두 팀에 공유 | ![](screenshots/us12-new-todo-team-default.png) ![](screenshots/us12-list-as-manager-B.png) ![](screenshots/us12-member-share-two-teams.png) |
| US-13 | 관리자 대리 등록 | ✅ | 소유자 선택지 A·B·C, C 선택 시 카테고리 비활성 '(비공개)'. 저장 후 C 목록에 카테고리 '기본'으로 표시 | ![](screenshots/us13-manager-create-for-member.png) |
| US-14 | 관리자가 구성원 할일 수정 | ✅ | B가 A의 '캠페인 일정' 제목 수정 성공. 카테고리 비활성, 공유 팀 읽기 전용 | ![](screenshots/ex24-manager-edit-category-disabled.png) |
| US-15 | 관리자 해제·구성원 제거 | ✅ | 해제된 B의 C 할일 수정 → 403. C 제거 확인 대화상자 → 제거 후 A·B는 '경쟁사 조사'·'보도자료 초안' 404, D(Sales)는 200 | ![](screenshots/us15-remove-member-confirm.png) ![](screenshots/us15-after-remove-member.png) |
| US-16 | 내 정보·시간대 | ✅ | 이메일 읽기 전용, 이름·비밀번호 변경. America/New_York 변경 후 '팀 회의' `11-12 00:00 EST`, 빈 일시 할일이 뉴욕 기준 오늘(11/05)로 저장 | ![](screenshots/us16-profile.png) ![](screenshots/us16-list-new-york-tz.png) |
| US-17 | 변경 이력 | ✅ | 소유자: 등록·수정·카테고리 변경·완료·해제 이력 모두 표시. 비소유자(C): 등록 이력에서 카테고리 줄 제외, 카테고리만 바꾼 이력은 숨김 | ![](screenshots/us17-history-owner.png) ![](screenshots/us17-history-non-owner.png) |
| US-18 | 소유자 팀 나가기 | ✅ | 다음 소유자 선택지 = B(C 제거 후), 선택 전 버튼 비활성. 나간 뒤 A 팀 목록 비어 있음, B=OWNER, '캠페인 일정' B에게 404 | ![](screenshots/us18-leave-team-dialog.png) ![](screenshots/us18-after-leave-teams.png) |
| US-21 | 언어 전환 | ✅ | 메뉴 한국어·English·中文·日本語. 日本語: `<html lang="ja">`, 캘린더 요일·버튼, '기본' → 'デフォルト'. English: 'Default'. 영어 로그인 오류 번역, 가입 필드 오류는 일반 문구 'Check your input.' | ![](screenshots/us21-calendar-japanese.png) ![](screenshots/us21-list-japanese-default-category.png) ![](screenshots/us21-login-error-english-dark.png) ![](screenshots/us21-signup-field-error-english.png) |
| US-22 | 테마 전환 | ✅ | Light·Dark·System, Dark 선택 시 `localStorage.theme=dark`, 새로고침 후 유지. 로그인 화면에 테마 버튼 없음 | ![](screenshots/us22-calendar-dark-en.png) ![](screenshots/us22-list-dark-en.png) |

### 2.2 예외·경계

| ID | 결과 | 확인 내용 (UI / API) | 스크린샷 |
|----|:---:|----------------------|----------|
| EX-02 | ✅ | 대문자 중복 이메일 → '이미 가입된 이메일입니다.' | ![](screenshots/ex02-signup-duplicate.png) |
| EX-03 | ✅ | `a@`·7자 비밀번호 → 필드별 오류 | ![](screenshots/ex03-signup-validation.png) |
| EX-04 | ✅ | 틀린 비밀번호와 없는 이메일 메시지 동일 | ![](screenshots/ex04-login-failed.png) |
| EX-05 | ✅ | 쿠키 없이 API → 401 `UNAUTHENTICATED` | - |
| EX-06 | ✅ | 로그아웃 전 리프레시 토큰으로 갱신 → 401 | - |
| EX-07 | ✅ | UI '종료 일시는 시작 일시보다 빠를 수 없습니다.' / API 400 `INVALID_PERIOD` | ![](screenshots/ex07-end-before-start.png) |
| EX-08 | ✅ | 종료 11/01만 입력 → `11-01 23:59 ~ 23:59` '기한 초과' | ![](screenshots/us04-todo-list-statuses.png) |
| EX-09 | ✅ | 빈 제목 → '제목을 입력해 주세요.' | ![](screenshots/ex09-empty-title.png) |
| EX-12, 13, 14 | ✅ | 상태별 필터에 각 1건씩만, 기한 초과는 진행 중 필터에 없음 | ![](screenshots/us08-filter-status-category.png) |
| EX-15 | ✅ | ' work ' UI 거부 / 'WORK' API 409 `CATEGORY_NAME_TAKEN` | ![](screenshots/ex15-category-duplicate.png) |
| EX-16 | ✅ | B가 'Work' 추가 201 | - |
| EX-17 | ✅ | 공백 이름 UI 거부 / API 400 | ![](screenshots/ex17-category-blank.png) |
| EX-18 | ✅ | 기본 카테고리 이름 변경·삭제 API 403 `DEFAULT_CATEGORY_PROTECTED` | - |
| EX-19 | ✅ | 남의 카테고리 수정·할일 지정 404 | - |
| EX-20 | ✅ | C 목록에서 남의 할일 체크·삭제 숨김, 읽기 전용 화면 / API 수정·삭제 403 | ![](screenshots/ex20-list-as-member-C.png) ![](screenshots/ex20-readonly-view.png) |
| EX-21 | ✅ | 공유 없는 할일 B·D 조회 404, UI '찾을 수 없습니다.' | ![](screenshots/ex21-private-todo-notfound.png) |
| EX-22 | ✅ | 비구성원 팀 공유 400 `INVALID_SHARE_TEAM` | - |
| EX-23 | ✅ | 관리자가 공유 팀 변경 403 | - |
| EX-24 | ✅ | 관리자 화면 카테고리 비활성 / API 403 | ![](screenshots/ex24-manager-edit-category-disabled.png) |
| EX-26 | ✅ | 비구성원 소유자 지정 400 `INVALID_OWNER` | - |
| EX-27 | ✅ | 미가입 이메일 → '가입되지 않은 이메일입니다.' | ![](screenshots/ex27-user-not-found.png) |
| EX-28 | ✅ | 관리자 B의 팀 상세에 구성원 관리 버튼 없음 / API 403 | ![](screenshots/ex28-team-detail-as-manager.png) |
| EX-29 | ✅ | ① 자기 제거 400 `VALIDATION_ERROR` ② 지정 없이 나가기 409 `OWNER_MUST_TRANSFER` | - |
| EX-30 | ✅ | UI '현재 비밀번호가 올바르지 않습니다.' / API 400 `WRONG_PASSWORD` | ![](screenshots/ex30-wrong-current-password.png) |
| EX-31 | ✅ | 이메일 수정 UI 없음, `PATCH /api/me {email}` 400 | ![](screenshots/us16-profile.png) |
| EX-32 | ✅ | 이력 삭제 API 404(없음) | - |
| EX-34 | ✅ | 이미 구성원 → '이미 팀 구성원입니다.' | ![](screenshots/ex34-already-member.png) |
| EX-35 | ✅ | ' sales-… ' 팀 이름 → '같은 이름의 팀이 있습니다.' | ![](screenshots/ex35-team-name-taken.png) |
| EX-36 | ✅ | 혼자인 팀 나가기 409 `NO_NEXT_OWNER` | - |
| EX-37 | ✅ | 이름 maxlength 50, 제목 200, 설명 2000 / 제목 201자 API 400 | - |
| EX-38 | ✅ | 일반 팀원이 남을 소유자로 등록 403 | - |
| EX-39 | ✅ | 캘린더 43일 조회 400 | - |
| EX-40 | ✅ | 일반 팀원 나가기 403, 비구성원 404 | - |
| EX-41 | ✅ | 비구성원을 다음 소유자로 지정 400 `INVALID_OWNER` | - |
| EX-43 | ✅ | 사용한 리프레시 토큰 재사용 401, 이후 새 토큰도 폐기(401) | - |
| EX-44 | ✅ | 비밀번호 변경 후 다른 세션(curl) 갱신 401 | - |
| EX-45, 46 | ✅ | `/login?error=OAUTH_FAILED`·`OAUTH_EMAIL_REQUIRED` 배너 번역 표시 | ![](screenshots/ex45-oauth-failed-banner.png) |
| EX-48 | ✅ | `next=//evil.example` → `oauth_state` 쿠키의 `next`가 `/`로 저장 | - |
| EX-49 | ✅ | `/api/auth/oauth/naver` 404 | - |

## 3. 발견 사항

### 3.1 [결함·Minor · 수정 완료] 시작=종료 23:59 할일이 캘린더에서 다음 날까지 그려짐
- **재현**: 종료 날짜만 과거(11/01)로 등록(EX-08) → 시작=종료=`11-01 23:59` → 데스크톱 월 뷰.
- **기대**: 11/01 칸에만 표시 (R15). **실제(수정 전)**: 11/01–11/02 두 칸에 막대가 걸침(주 뷰도 11/02 00:00 칸에 조각 표시). 모바일 월 뷰 개수(11/01 1건, 11/02 0건)와도 달랐다.
- **원인**: FullCalendar는 `end`가 `start`와 같으면 기본 길이(`defaultTimedEventDuration`, 1시간)를 적용해 끝을 다음 날 00:59로 본다. 14:00=14:00인 '팀 회의'는 같은 날 안이라 드러나지 않았다.
- **수정**: `frontend/src/pages/CalendarPage.tsx`의 `<FullCalendar>`에 `defaultTimedEventDuration="00:01"` 추가 (시작=종료 할일은 1분짜리로 그려 그날 안에 둔다). 커밋하지 않음.
- **재테스트 (2026-11-06 10:03, Playwright MCP, 1280×800)**: ✅
  - 월 뷰: '지난 정산' 막대 오른쪽 끝 284px ≤ 11/01 칸 오른쪽 끝 286px. 11/02 칸에 걸치지 않음.
  - 주 뷰(11/01–11/07): '지난 정산'이 11/01 열에만 1건, 11/02 상단 조각 사라짐.
  - 회귀 확인: '워크숍 준비'(11/05–11/07) 막대가 세 칸에 그대로 걸침, '팀 회의'(11/12 14:00=14:00) 11/12 칸 안에 표시.
  - 단위 테스트 `CalendarPage.test.tsx` 16건 통과, 타입 검사 통과. jsdom은 레이아웃을 계산하지 않아 이 결함을 재현하지 못하므로 단위 테스트는 추가하지 않았다.
- 수정 전: ![](screenshots/us09-calendar-month.png) ![](screenshots/us09-calendar-week.png)
- 수정 후: ![](screenshots/fix-calendar-month-same-start-end.png) ![](screenshots/fix-calendar-week-same-start-end.png)

### 3.2 [관찰] 개발 모드 콘솔 오류
- 모든 화면에서 `Encountered a script tag while rendering React component` 오류 1건. `next-themes`의 깜빡임 방지 인라인 스크립트에 대한 React 19 개발 모드 경고로, 동작 영향은 없다(테마 유지 정상).

### 3.3 [관찰] 관리자 대리 등록 시 공유 팀 필드 숨김
- US-13에서 소유자를 C로 바꾸면 등록 화면에서 '공유 팀' 그룹이 사라진다. 저장 결과는 마케팅팀에 정상 공유된다. 시나리오의 "공유 팀 = 마케팅팀" 표시 여부가 의도인지 확인 필요.

## 4. 미수행 항목
| ID | 사유 |
|----|------|
| US-19, US-20, EX-47 | 실제 Google 계정 로그인이 필요 (자동화 불가). 시작 리다이렉트·오류 배너·`next` 정화는 EX-45/46/48로 대체 확인 |
| EX-01, EX-33(실패 쪽) | DB 오류 주입 필요 |
| EX-10, EX-11 | 서버 시각 조작 필요 (분 단위 경계) |
| EX-42 | 액세스 토큰 만료(15분) 대기 필요 |
| US-08 #6 | 50건 초과 데이터 필요 (페이지네이션) |
| US-21 #1(프랑스어 브라우저), US-22 #4(OS 다크 전환) | 브라우저 언어·OS 설정 변경 필요. 저장값 없을 때 한국어 기본 표시는 확인 |
