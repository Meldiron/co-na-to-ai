import "@tanstack/react-start/server-only"
import { getRequestHeader } from "@tanstack/react-start/server"
import { Account, Client, Functions, Storage, TablesDB } from "node-appwrite"
import { SITE_URL } from "@/lib/site"

export const DATABASE = process.env.DAILY_DATABASE ?? "ai100"

function project() {
  const endpoint = process.env.APPWRITE_SITE_API_ENDPOINT
  const id = process.env.APPWRITE_SITE_PROJECT_ID
  return endpoint && id ? { endpoint, id } : null
}

export function appwrite() {
  const target = project()
  const key = process.env.APPWRITE_API_KEY ?? getRequestHeader("x-appwrite-key")
  if (!target || !key) return null
  const sdk = new Client().setEndpoint(target.endpoint).setProject(target.id).setKey(key).setLocale("cs")
  return { storage: new Storage(sdk), functions: new Functions(sdk), tables: new TablesDB(sdk), account: new Account(sdk) }
}

export function siteOrigin(): string {
  const host = getRequestHeader("host") ?? ""
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : SITE_URL
}

export function asUser(secret: string) {
  const target = project()
  if (!target) return null
  const sdk = new Client().setEndpoint(target.endpoint).setProject(target.id).setSession(secret)
  return { account: new Account(sdk) }
}
