export const NAME_MIN = 2
export const NAME_MAX = 24

export function guestName(userId: string): string {
  return `Host ${userId.slice(-4).toUpperCase()}`
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim()
}
