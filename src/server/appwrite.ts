import "@tanstack/react-start/server-only"
import { getRequestHeader } from "@tanstack/react-start/server"
import { Account, Client, Functions, Storage, TablesDB } from "node-appwrite"

export const DATABASE = process.env.DAILY_DATABASE ?? "ai100"

function project() {
  const endpoint = process.env.APPWRITE_SITE_API_ENDPOINT
  const id = process.env.APPWRITE_SITE_PROJECT_ID
  return endpoint && id ? { endpoint, id } : null
}

export function appwrite() {
  const target = project()
  const key = getRequestHeader("x-appwrite-key") ?? process.env.APPWRITE_API_KEY
  if (!target || !key) return null
  const sdk = new Client().setEndpoint(target.endpoint).setProject(target.id).setKey(key)
  return { storage: new Storage(sdk), functions: new Functions(sdk), tables: new TablesDB(sdk), account: new Account(sdk) }
}

export function asUser(secret: string) {
  const target = project()
  if (!target) return null
  const sdk = new Client().setEndpoint(target.endpoint).setProject(target.id).setSession(secret)
  return { account: new Account(sdk) }
}
