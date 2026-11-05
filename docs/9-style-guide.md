# TodoList 프론트엔드 스타일 가이드

| 항목 | 내용 |
|------|------|
| 문서 버전 | v0.2 |
| 상태 | 초안 |
| 최종 수정일 | 2026-11-05 |
| 작성자 | hjining |
| 기준 문서 | `docs/4-wireframe.md` v0.13, `docs/5-project-principle.md`(FE-08, FE-09, G-11, G-16) |

> - 이 문서는 와이어프레임의 요소를 **어떤 shadcn 컴포넌트와 어떤 Tailwind 클래스로 그릴지**만 정한다. 기능·문구는 와이어프레임을 따른다.
> - 컴포넌트는 shadcn MCP(`@shadcn` 레지스트리)로 추가한다(FE-08). 레지스트리에 없는 부품은 6장 규칙으로 만든다.
> - 다크 모드, 브랜드 색, 커스텀 폰트는 두지 않는다(기준 문서에 없음).

## 1. 기본 원칙

1. **shadcn 기본 테마 그대로.** `npx shadcn init`이 만든 neutral 테마 변수(`src/index.css`)를 바꾸지 않는다(G-16).
2. **색은 토큰으로만.** `bg-primary`, `text-muted-foreground`, `border-input`, `text-destructive`처럼 테마 변수 클래스만 쓴다. `bg-blue-500`, `#hex` 같은 고정 색은 쓰지 않는다. **예외**: 팀 캘린더 팔레트(6.3 CL-03)와 여러 팀 전용 색(슬레이트)은 사용자가 고르는 데이터 색이라 7장 표의 hex를 그대로 쓴다(`style`의 `backgroundColor` 허용).
3. **생성 파일은 고치지 않는다.** `shared/components/ui/*`는 그대로 두고, 도메인 표현은 감싼 컴포넌트에서 `variant`·`className`으로 만든다(FE-09).
4. **스타일 수단은 Tailwind 클래스뿐.** 별도 CSS 파일과 인라인 `style`은 FullCalendar 덮어쓰기(7장) 외에는 쓰지 않는다(FE-09).
5. **아이콘은 `lucide-react`**, 크기는 shadcn 기본(`size-4`)을 따른다.

## 2. 디자인 토큰

### 2.1 색 (shadcn 테마 변수)
| 용도 | 클래스 | 사용처 |
|------|--------|--------|
| 페이지 배경·글자 | `bg-background` `text-foreground` | `body` |
| 주요 동작 | `bg-primary` `text-primary-foreground` | 저장, 로그인, 가입, + 할일 등록 |
| 보조 면 | `bg-secondary` / `bg-muted` | 현재 메뉴 강조, 스켈레톤, 표 머리 |
| 보조 글자 | `text-muted-foreground` | 안내 문구, 글자 수, 기간, '(비우면 00:00)' |
| 위험 | `text-destructive` / `variant="destructive"` | 삭제·제거 확인 버튼, 필드 오류, 필수 `*` |
| 테두리 | `border` (`border-border`) / `border-input` | 구분선, 입력란 |
| 포커스 | `ring-ring/50` | 6장 직접 만드는 부품 |

### 2.2 타이포그래피
| 요소 | 클래스 |
|------|--------|
| 로고 'TodoList' | `text-lg font-semibold` |
| 페이지 제목(할일 목록, 카테고리 …) | `text-2xl font-semibold tracking-tight` |
| 섹션 제목(구성원 추가, 비밀번호 변경) | `text-lg font-semibold` |
| 본문·입력·표 | `text-sm` (shadcn 기본) |
| 보조 문구·글자 수·필드 오류 | `text-xs` 또는 `text-sm` + `text-muted-foreground` / `text-destructive` |

폰트는 Tailwind 기본 `font-sans`를 쓴다.

### 2.3 간격·크기·모서리
| 항목 | 값 |
|------|-----|
| 간격 단위 | Tailwind 4px 단위. 요소 사이 `gap-2`, 필드 사이 `gap-4`, 섹션 사이 `gap-6`/`gap-8` |
| 컨트롤 높이 | shadcn 기본 `h-9`(Button·Input·Select). 행 안 작은 버튼은 `size="sm"`(`h-8`) |
| 모서리 | 테마 `--radius` 기준. 컨트롤 `rounded-md`, 카드·대화상자 `rounded-lg`/`rounded-xl`(shadcn 기본) |
| 그림자 | shadcn 기본만(`shadow-xs` 입력, `shadow-sm` 카드). 추가하지 않는다 |

### 2.4 레이아웃·반응형
| 항목 | 규칙 |
|------|------|
| 브레이크포인트 | Tailwind `md`(768px) 하나만 쓴다. 기본(접두사 없음) = 모바일, `md:` = 데스크톱(와이어프레임 1.2) |
| 본문 폭 | `mx-auto w-full max-w-5xl px-4 py-6` (SC-03–SC-09 공통) |
| 화면 높이 맞춤(SC-03, SC-05) | 데스크톱(`md:`)은 페이지 루트를 `flex flex-col md:h-[calc(100svh-6.5rem)]`(화면 높이 − 헤더 `h-14` − 본문 `py-6`)로 두어 페이지 자체는 스크롤하지 않는다. SC-03은 표 영역만 안에서 스크롤하고 표 머리는 `sticky`, 페이지 바는 항상 아래에 보인다. SC-05는 캘린더가 남은 높이를 채운다(`height=100%`). 주·일 뷰도 1시간 칸 24개(`slotDuration 01:00`, `expandRows`, 시간 칸 `text-xs`)가 남은 높이를 나눠 스크롤이 없다(창 높이 약 700px 미만에서만 시간 영역이 스크롤). 모바일은 페이지 전체 스크롤 |
| 폼 화면 폭 | SC-04, SC-07: 본문 안 `max-w-2xl` |
| 인증 화면(SC-01, SC-02) | `flex min-h-svh items-center justify-center p-4` + `Card className="w-full max-w-sm"` |
| 페이지 머리 | `flex items-center justify-between gap-2` (제목 왼쪽, 주요 버튼 오른쪽) |
| 데스크톱 폼 라벨 | 라벨 왼쪽·입력 오른쪽은 `Field orientation="horizontal"`, 모바일은 위아래로 쌓는다 |

## 3. 와이어프레임 요소 → shadcn 컴포넌트

추가 명령: `npx shadcn@latest add <이름>` (또는 shadcn MCP `get_add_command_for_items`)

### 3.1 공통 (P0에서 한 번에 추가)
```
button input textarea label field select native-select checkbox badge table
card dialog alert-dialog sheet alert skeleton empty spinner sonner
tabs toggle-group collapsible separator pagination popover command
```

### 3.2 매핑표
| 와이어프레임 요소 | shadcn 컴포넌트 | 사용법 |
|---|---|---|
| 상단 내비게이션(SC-00) | `Button variant="ghost" asChild` + 라우터 `Link` | 현재 메뉴는 `variant="secondary"`. 헤더는 `sticky top-0 h-14 border-b bg-background`. `NavigationMenu`는 쓰지 않는다(하위 메뉴 없음) |
| 햄버거 메뉴(모바일) | `Sheet side="left"` + `Button variant="ghost" size="icon"`(`Menu` 아이콘) | `md:hidden`. 메뉴 항목 선택 시 `open=false` |
| 사용자 이름·로그아웃 | 텍스트 `text-sm text-muted-foreground` + `Button variant="outline" size="sm"` | |
| 인증 폼 카드(SC-01, SC-02) | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` | 로그인 버튼 `className="w-full"` |
| 입력 필드 묶음 | `FieldGroup` > `Field` > `FieldLabel` + `Input` + `FieldDescription` / `FieldError` | 오류 시 `Field data-invalid`, `Input aria-invalid` (빨간 테두리는 shadcn이 처리) |
| 폼 오류(폼 상단) | `Alert variant="destructive"` + `AlertDescription` | 서버 `error.message` 그대로 |
| 설명 입력 | `Textarea` | `maxLength={2000}` |
| 날짜·시각 입력 | `Input type="date"` / `Input type="time"` | 브라우저 기본 위젯 + shadcn 스타일(A22). Date Picker·Calendar 쓰지 않음 |
| 일반 선택 상자 | `Select` | 카테고리, 상태, 역할, 팀, 소유자, 다음 소유자 |
| 보기 필터(F4) | `Select` + `SelectGroup` / `SelectLabel`('팀', '사용자') / `SelectSeparator` | 와이어프레임 4.4 펼친 모습 그대로 |
| 시간대 선택(SC-07) | Combobox = `Popover` + `Command`(`CommandInput`, `CommandList`, `CommandItem`) | IANA 전체 목록 검색 [U-17] |
| 모바일 필터 접기 | `Collapsible` + `Button variant="outline"`(`ListFilter` 아이콘) | 데스크톱은 `md:flex`로 항상 펼침 |
| 할일 표(데스크톱) | `Table` | `hidden md:table` |
| 할일 행(모바일) | `div` 목록 `divide-y` (6.4) | `md:hidden` |
| 완료 체크·공유 팀 | `Checkbox` + `Label` | 공유 팀은 `flex flex-wrap gap-4` |
| 상태 배지 | `Badge` 감싼 `StatusBadge` (4장) | |
| 역할 표시 | `Badge variant="outline"` | 소유자/관리자/일반 팀원 |
| 페이지네이션 | `Pagination`, `PaginationPrevious`, `PaginationNext` + 가운데 `1 / 3` 텍스트 | 번호 링크 목록은 쓰지 않는다 [U-12] |
| 상세 / 변경 이력 탭 | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | 탭 전환해도 폼 상태 유지(같은 컴포넌트 안에 둠) |
| 월·주·일 전환 | `ToggleGroup type="single" variant="outline"` | |
| 이전·오늘·다음 | `Button variant="outline" size="icon"`(`ChevronLeft/Right`) + `Button variant="outline"`('오늘') | |
| 확인 대화상자(DLG-01, 02, 05) | `AlertDialog` | 확인 버튼 `AlertDialogAction className={buttonVariants({ variant: "destructive" })}` |
| 입력 대화상자(DLG-03, 04) | `Dialog` + `DialogFooter` | 취소 `variant="outline"`, 확인 `default` |
| 저장하지 않은 변경 확인(SC-04 취소) | `AlertDialog` | 확인 버튼 `default` |
| ST-02 찾을 수 없음 | `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyContent` + [목록으로] 버튼 | |
| ST-03 / ST-04 알림 막대 | `Alert variant="destructive"` (본문 상단) | ST-04는 `Button variant="outline" size="sm"` [다시 시도] |
| 500건 초과 안내 띠(SC-05) | `Alert` (기본 variant) | |
| 빈 상태(목록·팀) | `Empty` + 버튼 | 문구는 와이어프레임 3.6 |
| 로딩 | `Skeleton` (표 행 `h-10`, 폼 필드 `h-9`) | |
| 제출 중 | `Button disabled` + 앞에 `Spinner` | |
| 토스트(SC-07 저장 성공) | `sonner`의 `toast()` + 루트에 `<Toaster />` | |
| 구분선 | `Separator` | 섹션 사이 |

### 3.3 버튼 variant 규칙
| 동작 | variant |
|------|---------|
| 화면의 주요 동작 1개(저장, 로그인, 가입, 추가, + 할일 등록, 생성) | `default` |
| 취소, 필터 초기화, 이동 버튼, 로그아웃, 다시 시도 | `outline` |
| 행 안의 수정·관리자 지정/해제 | `outline` `size="sm"` |
| 행 안의 삭제·제거, 화면의 [삭제] | `ghost` `size="sm"` + `text-destructive` (또는 `Trash2` 아이콘 `size="icon"`) |
| 대화상자의 최종 삭제·제거 | `destructive` |
| 회원가입·로그인 링크, 팀 목록으로 | `link` |

- 한 화면에 `default` 버튼은 하나만 둔다(SC-09는 섹션마다 하나).
- 아이콘+글자 버튼: `<Button><Plus /> 할일 등록</Button>` (아이콘 크기는 Button이 맞춤).

## 4. 할일 상태 배지 (와이어프레임 3.3)

새 색을 만들지 않고 `Badge` 기본 variant만 쓴다. 항상 글자를 함께 쓴다.

| 상태 | 문구 | `Badge` variant |
|------|------|-----------------|
| S1 완료 | 완료 | `secondary` |
| S2 기한 초과 | 기한 초과 | `destructive` |
| S3 시작 전 | 시작 전 | `outline` |
| S4 진행 중 | 진행 중 | `default` |

```tsx
// features/todos/components/StatusBadge.tsx
const VARIANT = { COMPLETED: 'secondary', OVERDUE: 'destructive', NOT_STARTED: 'outline', IN_PROGRESS: 'default' } as const
const LABEL = { COMPLETED: '완료', OVERDUE: '기한 초과', NOT_STARTED: '시작 전', IN_PROGRESS: '진행 중' } as const
export function StatusBadge({ status }: { status: TodoStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
}
```
> 상태 키 이름은 API 응답(`docs/8-swagger.yaml`)의 실제 값에 맞춘다.

## 5. 화면별 구성 요약

| 화면 | 구성 |
|------|------|
| SC-00 | `header`(로고 · 메뉴 `hidden md:flex` · 이름+로그아웃) / 모바일 `Sheet` / `main`(2.4 본문 폭) |
| SC-01, SC-02 | `Card` 가운데 정렬 · `Alert`(폼 오류) · `FieldGroup` · 전체 폭 `Button` · `CardFooter`에 `link` 버튼 |
| SC-03 | 페이지 머리 · 필터 바(`flex flex-wrap items-end gap-2`, 모바일 `Collapsible`) · `Table`/모바일 행 · `Pagination` + `총 N건`(`text-sm text-muted-foreground`) |
| SC-04 | 머리(제목 + `Tabs`) · 소유자 텍스트(`text-sm text-muted-foreground`) · `FieldGroup`(라벨 왼쪽) · 하단 `flex justify-between`([삭제] 왼쪽, [취소][저장] 오른쪽). 읽기 전용은 입력 대신 `p.text-sm` |
| SC-05 | 툴바(`flex flex-wrap items-center gap-2`: 이동 · 기간 제목 `text-lg font-semibold` · `ToggleGroup` · 등록 버튼 `ml-auto`) · 보기 `Select` · `Alert`(500건) · FullCalendar(7장) |
| SC-06 | 추가 폼(`flex gap-2`: `Input` + 글자 수 + `Button`) · 목록 `divide-y rounded-md border` · 기본 카테고리 행에 `Badge variant="secondary"`('기본') + 비활성 버튼 |
| SC-07 | 두 개의 `Card`(내 정보 / 비밀번호 변경), 각자 저장 버튼 [U-17] |
| SC-08 | 페이지 머리 · `Table`(팀 이름, 내 역할 `Badge`) · 행 클릭 이동(`cursor-pointer hover:bg-muted/50`은 `TableRow` 기본) |
| SC-09 | 머리(`link` 버튼 '< 팀 목록' · 팀 이름 · 내 역할) · 구성원 추가 `Card`(소유자만) · 구성원 `Table` · 행 버튼 `size="sm"` |

## 6. shadcn에 없는 부품 만들기

레지스트리에 없는 부품은 아래 규칙으로 **shadcn 부품을 조합**해 만든다. 새 부품이 shadcn 부품과 나란히 있어도 구분되지 않아야 한다.

### 6.1 규칙
1. **먼저 조합을 찾는다.** shadcn 부품 조합으로 되면 새 스타일을 만들지 않는다(예: Combobox = Popover + Command).
2. **shadcn 소스의 클래스를 복사해 쓴다.** 새로 디자인하지 말고 비슷한 shadcn 부품의 클래스를 가져온다. 필요하면 shadcn MCP `view_items_in_registries` / `get_item_examples_from_registries`로 원본을 확인한다.
3. **공통 상태 클래스는 shadcn과 똑같이:**
   | 상태 | 클래스 (shadcn 기본과 동일) |
   |------|------|
   | 포커스 | `outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50` |
   | 비활성 | `disabled:pointer-events-none disabled:opacity-50` |
   | 오류 | `aria-invalid:border-destructive aria-invalid:ring-destructive/20` |
   | 호버(행·항목) | `hover:bg-muted/50` (TableRow와 동일) / `hover:bg-accent hover:text-accent-foreground` (메뉴 항목) |
   | 전환 | `transition-colors` |
4. **`cn()`으로 `className`을 받는다.** `({ className, ...props }) => <div className={cn('기본 클래스', className)} {...props} />` 형태로, shadcn 부품과 같은 사용법을 유지한다.
5. **위치**: 도메인 무관 부품은 `src/shared/components/`, 도메인 부품은 `src/features/<도메인>/components/`. `shared/components/ui/`에는 두지 않는다(생성 코드 전용).
6. **이름은 shadcn 이름과 겹치지 않게**(N-10): `CharCounter`, `RequiredMark`, `TodoMobileRow` 등.

### 6.2 이 프로젝트에서 직접 만드는 부품
| 부품 | 쓰는 곳 | 구현 |
|------|---------|------|
| `RequiredMark` | 필수 라벨 `*` | `<span className="text-destructive">*</span>` |
| `CharCounter` | 제목·설명·이름 `(0/200)` | `<span className="text-xs text-muted-foreground tabular-nums">{n}/{max}</span>`. `Field` 안 입력란 아래 오른쪽(`flex justify-end`) |
| `PageHeader` | 각 페이지 머리 | `<div className="flex items-center justify-between gap-2"><h1 className="text-2xl font-semibold tracking-tight">…</h1>{actions}</div>` |
| `TodoMobileRow` | SC-03 모바일 행 | 6.4 |
| `HistoryList` | SC-04 이력 탭 | 6.5 |
| `PeriodText` | 기간 `시작 ~ 종료` | `<span className="text-sm text-muted-foreground tabular-nums">` (형식은 와이어프레임 3.4) |

### 6.3 읽기 전용 값 (SC-04 읽기 전용, SC-07 이메일)
입력란 대신 같은 자리에 텍스트를 둔다. 라벨은 `FieldLabel` 그대로, 값은 `<p className="text-sm">`. 비활성 Input으로 대신하지 않는다(C-14: "텍스트로만").

### 6.4 할일 모바일 행 (SC-03, < 768px)
`Table` 행과 같은 높이감·호버·구분선을 쓴다.
```tsx
<li className="flex items-start gap-3 py-3">
  {canEdit && <Checkbox className="mt-0.5" />}
  <div className="min-w-0 flex-1 space-y-1">
    <div className="flex items-center justify-between gap-2">
      <Link className="truncate text-sm font-medium hover:underline">{title}</Link>
      <StatusBadge status={status} />
    </div>
    <div className="flex items-center justify-between">
      <PeriodText … />
      {canEdit && <Button variant="ghost" size="sm" className="text-destructive">삭제</Button>}
    </div>
  </div>
</li>
// 목록: <ul className="divide-y md:hidden">
```

### 6.5 변경 이력 목록 (SC-04 이력 탭, P1)
```tsx
<ol className="divide-y">
  <li className="space-y-1 py-3">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="tabular-nums text-muted-foreground">2026-11-05 10:12</span>
      <span className="font-medium">홍길동</span>
      <Badge variant="outline">수정</Badge>
    </div>
    <ul className="space-y-0.5 pl-4 text-sm text-muted-foreground">
      <li>공유 팀: (없음) → 마케팅팀</li>
    </ul>
  </li>
</ol>
```

## 7. FullCalendar 테마 맞추기 (SC-05)

FullCalendar는 shadcn에 없으므로 **CSS 변수로 shadcn 토큰에 연결**한다. 와이어프레임 1.2는 기본 스타일도 허용하지만, 화면 일관성을 위해 아래 최소 덮어쓰기만 한다. 이 블록은 FE-09가 허용한 유일한 별도 CSS이며 `src/index.css` 맨 아래에 둔다.

```css
/* FullCalendar → shadcn 토큰 연결 (FE-09 예외) */
.fc {
  --fc-border-color: var(--border);
  --fc-page-bg-color: var(--background);
  --fc-neutral-bg-color: var(--muted);
  --fc-today-bg-color: color-mix(in oklch, var(--primary) 6%, transparent);
  --fc-event-bg-color: var(--primary);
  --fc-event-border-color: var(--primary);
  --fc-event-text-color: var(--primary-foreground);
  --fc-more-link-text-color: var(--muted-foreground);
  font-size: 0.875rem; /* text-sm */
}
.fc .fc-event { border-radius: calc(var(--radius) - 4px); }
.fc .fc-col-header-cell-cushion { color: var(--muted-foreground); font-weight: 500; }
```

- FullCalendar 자체 툴바는 끈다(`headerToolbar={false}`). 이동·뷰 전환은 3.2의 shadcn `Button`·`ToggleGroup`으로 만들고 `calendarRef.current.getApi()`로 조작한다. 버튼 모양을 따로 맞출 필요가 없어진다.
- 막대 색은 팀 기준이고 모양은 상태 기준이다(아래 7.1·7.2). 상태 배지는 캘린더에 표시하지 않는다(와이어프레임 4.6).
- 모바일 월 뷰의 '개수만 표시'도 같은 토큰(`text-muted-foreground text-xs`)을 쓴다.

### 7.1 팀 캘린더 팔레트 (6.3 CL-03, 고정 색 금지의 예외)
키로 저장하고, 화면은 아래 hex로 그린다. 구현: `src/features/teams/teamColors.ts`.

| 키 | 이름 | 색 | 채움일 때 글자 |
|----|------|----|----------------|
| RED | 빨강 | `#DC2626` | 흰색 |
| ORANGE | 주황 | `#C2410C` | 흰색 |
| YELLOW | 노랑 | `#FACC15` | 검정 |
| GREEN | 초록 | `#15803D` | 흰색 |
| TEAL | 청록 | `#0F766E` | 흰색 |
| BLUE | 파랑 | `#2563EB` | 흰색 |
| VIOLET | 보라 | `#7C3AED` | 흰색 |
| PINK | 분홍 | `#BE185D` | 흰색 |
| (여러 팀 전용) | - | `#64748B` 슬레이트 | 흰색 |

색 미설정 팀은 내 팀 목록 순서로 위 8색을 순환 배정한다. 개인 할일(공유 팀 0개)은 `--primary`·`--primary-foreground`다.

### 7.2 막대 상태 규칙 (6.3 CL-04·CL-05)
| 상태 | 모양 |
|------|------|
| 진행 중 | 배경 = 색, 글자 = 채움 글자색 |
| 시작 전 | 배경 = 색 15%(`color-mix`), 테두리 = 색, 글자 = 색(노랑은 검정 쪽으로 어둡게) |
| 완료 | 시작 전과 같은 연한 배경 + 취소선(`line-through`) + `opacity-50` |
| 기한 초과 | 채움 + 왼쪽 굵은 띠(`border-l-4`, `destructive`) + `TriangleAlert`(`size-3`) |

- 공유 팀 2개 이상이면 제목 앞에 `Users` 아이콘(`size-3`)을 붙인다. 아이콘은 `aria-hidden`이다.
- 막대 라벨은 제목만 `font-semibold`로 쓰고 시각은 쓰지 않는다. 막대 `title`(툴팁)은 `공유 팀: A, B`만(공유 팀 없으면 툴팁 없음).
- 색 견본(`TeamColorPicker`)은 `radiogroup`/`radio`(`aria-label` = 색 이름, `aria-checked`)이며 6.1의 포커스·비활성 클래스를 쓴다. 색 점(`TeamColorDot`)은 `size-2.5 rounded-full`, `aria-hidden`.

## 8. 체크리스트 (화면 구현 후)

- [ ] 고정 색(`*-blue-500`, `#hex`)을 쓰지 않았다
- [ ] `shared/components/ui/` 파일을 고치지 않았다
- [ ] 상태는 `StatusBadge`(글자 포함)로만 표시했다
- [ ] 한 화면(섹션)에 `default` 버튼은 하나다
- [ ] 375px 폭에서 가로 스크롤이 없고, 768px에서 데스크톱 레이아웃으로 바뀐다
- [ ] 직접 만든 부품은 6.1의 포커스·비활성·오류 클래스를 갖는다
- [ ] 제출 중 버튼이 비활성 + `Spinner`다

## 9. 변경 이력

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| v0.1 | 2026-11-05 | hjining | 초안. 와이어프레임 v0.12 기준 shadcn 컴포넌트 매핑, 토큰, 상태 배지, 비-shadcn 부품 규칙, FullCalendar 테마 연결 |
| v0.2 | 2026-11-05 | hjining | 팀 캘린더 팔레트·여러 팀 색을 고정 색 금지의 예외로 명시(1장), 7장에 팔레트 표(7.1)와 막대 상태 규칙(7.2) 추가(UI-13, 6.3 CL-01–CL-06) |
