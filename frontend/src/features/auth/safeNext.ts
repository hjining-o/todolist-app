// ?next= 는 앱 내부 경로만 허용한다(U-15). '//evil', '/\evil' 같은 외부 이동 우회는 막는다
export function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next
  return '/todos'
}
