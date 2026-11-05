export function CharCounter({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {value.length}/{max}
    </span>
  )
}
