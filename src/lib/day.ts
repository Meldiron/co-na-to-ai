export const LAUNCH_DATE = "2026-10-24"
export const TIME_ZONE = "Europe/Prague"

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function pragueDate(now: Date = new Date()): string {
  return isoFormatter.format(now)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000,
  )
}

export function puzzleNumber(date: string): number {
  return daysBetween(LAUNCH_DATE, date) + 1
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const d = new Date(`${date}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date
}

const longFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
})

const shortFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function formatLong(date: string): string {
  return longFormatter.format(new Date(`${date}T12:00:00Z`))
}

export function formatShort(date: string): string {
  return shortFormatter.format(new Date(`${date}T12:00:00Z`))
}

export function msUntilNextPragueMidnight(now: Date = new Date()): number {
  const today = pragueDate(now)
  let lo = now.getTime()
  let hi = lo + 26 * 3_600_000
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2)
    if (pragueDate(new Date(mid)) === today) lo = mid
    else hi = mid
  }
  return hi - now.getTime()
}
