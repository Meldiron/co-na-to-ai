import "@tanstack/react-start/server-only"
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server"
import { AppwriteException, type Models } from "node-appwrite"
import { appwrite, asUser } from "./appwrite"

const COOKIE = "pjs100_session"
const YEAR_S = 365 * 24 * 60 * 60

export type User = Models.User<Models.Preferences>
export type Session = { user: User; secret: string }

export function remember(secret: string): void {
  setCookie(COOKIE, secret, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: YEAR_S })
}

export function forget(): void {
  deleteCookie(COOKIE, { path: "/" })
}

export async function currentSession(): Promise<Session | null> {
  const secret = getCookie(COOKIE)
  const client = secret ? asUser(secret) : null
  if (!secret || !client) return null
  try {
    return { user: await client.account.get(), secret }
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      forget()
      return null
    }
    throw error
  }
}

export async function ensureSession(): Promise<Session> {
  const existing = await currentSession()
  if (existing) return existing
  const admin = appwrite()
  if (!admin) throw new Error("Účty teď nejsou k dispozici.")
  const { secret } = await admin.account.createAnonymousSession()
  remember(secret)
  return { user: await asUser(secret)!.account.get(), secret }
}

export function isAdmin(user: User | null | undefined): boolean {
  return user?.labels.includes("admin") ?? false
}

export async function requireAdmin(): Promise<User> {
  const session = await currentSession()
  if (!isAdmin(session?.user)) throw new Error("Tohle může jen správce.")
  return session!.user
}
