import "@tanstack/react-start/server-only"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server"

const COOKIE = "pjs100_admin"
const TTL_MS = 7 * 24 * 60 * 60 * 1000

function password(): string {
  const value = process.env.ADMIN_PASSWORD
  if (!value) throw new Error("ADMIN_PASSWORD is not set")
  return value
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest()
}

function sign(expires: number): string {
  return createHmac("sha256", digest(`pjs100-session:${password()}`)).update(String(expires)).digest("base64url")
}

export function checkPassword(input: string): boolean {
  return timingSafeEqual(digest(input), digest(password()))
}

export function startSession(): void {
  const expires = Date.now() + TTL_MS
  setCookie(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  })
}

export function endSession(): void {
  deleteCookie(COOKIE, { path: "/" })
}

export function isAdmin(): boolean {
  const value = getCookie(COOKIE)
  if (!value) return false
  const [rawExpires, signature = ""] = value.split(".")
  const expires = Number(rawExpires)
  if (!Number.isFinite(expires) || expires < Date.now()) return false
  const expected = Buffer.from(sign(expires))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function requireAdmin(): void {
  if (!isAdmin()) throw new Error("Nejste přihlášeni.")
}
