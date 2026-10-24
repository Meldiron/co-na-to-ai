import "@tanstack/react-start/server-only"
import { getRequestHeader } from "@tanstack/react-start/server"
import { Client, Functions, Storage, TablesDB } from "node-appwrite"

export function appwrite() {
  const endpoint = process.env.APPWRITE_SITE_API_ENDPOINT
  const project = process.env.APPWRITE_SITE_PROJECT_ID
  const key = getRequestHeader("x-appwrite-key")
  if (!endpoint || !project || !key) return null
  const sdk = new Client().setEndpoint(endpoint).setProject(project).setKey(key)
  return { storage: new Storage(sdk), functions: new Functions(sdk), tables: new TablesDB(sdk) }
}
