export type LocalDateString = `${number}-${number}-${number}`

const APP_TIME_ZONE = 'Europe/Bucharest'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDateParts(dateString: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null
  const [year, month, day] = dateString.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day, 12))
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? { year, month, day }
    : null
}

function formatUtcDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function getTimeZoneParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function getAppTimeZoneOffsetMs(date: Date): number {
  const parts = getTimeZoneParts(date)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return zonedAsUtc - (date.getTime() - date.getUTCMilliseconds())
}

function appLocalDateTimeToUtc(
  dateString: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const parts = parseDateParts(dateString) ?? parseDateParts(getLocalDateString())!
  const wallClockUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond)
  let offset = getAppTimeZoneOffsetMs(new Date(wallClockUtc))
  let result = new Date(wallClockUtc - offset)
  const adjustedOffset = getAppTimeZoneOffsetMs(result)
  if (adjustedOffset !== offset) result = new Date(wallClockUtc - adjustedOffset)
  return result
}

export function getLocalDateString(date = new Date()): string {
  const parts = getTimeZoneParts(date)
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

export function parseLocalDateString(value: string): Date | null {
  const parts = parseDateParts(value)
  if (!parts) return null
  const { year, month, day } = parts
  const parsed = new Date(year, month - 1, day)
  return parsed
}

export function parseDateParamSafe(
  value: string | null | undefined,
  fallback = getLocalDateString(),
): string {
  return value && parseLocalDateString(value) ? value : fallback
}

export function addLocalDays(dateString: string, days: number): string {
  const parts = parseDateParts(dateString) ?? parseDateParts(getLocalDateString())!
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
  base.setUTCDate(base.getUTCDate() + days)
  return formatUtcDateString(base)
}

export function getLocalDateDaysAgo(days: number, base = new Date()): string {
  return addLocalDays(getLocalDateString(base), -days)
}

export function getLocalDayBounds(dateString: string): { start: string; end: string } {
  const date = parseDateParts(dateString) ? dateString : getLocalDateString()
  const start = appLocalDateTimeToUtc(date, 0, 0, 0, 0)
  const end = appLocalDateTimeToUtc(date, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function timestampForSelectedDate(dateString: string): string {
  const date = parseDateParts(dateString) ? dateString : getLocalDateString()
  return appLocalDateTimeToUtc(date, 12, 0, 0, 0).toISOString()
}

export function getLocalWeekStartString(date = new Date()): string {
  const parts = parseDateParts(getLocalDateString(date))!
  const weekStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
  const day = weekStart.getUTCDay() === 0 ? 6 : weekStart.getUTCDay() - 1
  weekStart.setUTCDate(weekStart.getUTCDate() - day)
  return formatUtcDateString(weekStart)
}
