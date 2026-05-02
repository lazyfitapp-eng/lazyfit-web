export type LocalDateString = `${number}-${number}-${number}`

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function getLocalDateString(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseLocalDateString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null
}

export function parseDateParamSafe(
  value: string | null | undefined,
  fallback = getLocalDateString(),
): string {
  return value && parseLocalDateString(value) ? value : fallback
}

export function addLocalDays(dateString: string, days: number): string {
  const base = parseLocalDateString(dateString) ?? new Date()
  base.setDate(base.getDate() + days)
  return getLocalDateString(base)
}

export function getLocalDateDaysAgo(days: number, base = new Date()): string {
  const date = new Date(base)
  date.setDate(date.getDate() - days)
  return getLocalDateString(date)
}

export function getLocalDayBounds(dateString: string): { start: string; end: string } {
  const date = parseLocalDateString(dateString) ?? new Date()
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function getLocalWeekStartString(date = new Date()): string {
  const weekStart = new Date(date)
  const day = weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1
  weekStart.setDate(weekStart.getDate() - day)
  weekStart.setHours(0, 0, 0, 0)
  return getLocalDateString(weekStart)
}
