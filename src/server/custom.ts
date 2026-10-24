import "@tanstack/react-start/server-only"
import { randomBytes } from "node:crypto"
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { getRequestHeader } from "@tanstack/react-start/server"
import { Client, Functions, Query, Storage } from "node-appwrite"
import { CUSTOM_ID, generateCustomGame, type CustomGame } from "../../pipeline/custom-game"
import { answerers } from "@/lib/cast"

export type { CustomGame }

export type Job = {
  id: string
  question: string
  state: "asking" | "judging" | "done" | "failed"
  done: number
  total: number
  executionId?: string
  error?: string
}

const BUCKET = process.env.CUSTOM_GAMES_BUCKET ?? "custom-games"
const FUNCTION = process.env.CUSTOM_GAME_FUNCTION ?? "custom-game"
const DIR = process.env.CUSTOM_GAMES_DIR ?? join(process.cwd(), "custom")
const jobs = new Map<string, Job>()

function appwrite() {
  const endpoint = process.env.APPWRITE_SITE_API_ENDPOINT
  const project = process.env.APPWRITE_SITE_PROJECT_ID
  const key = getRequestHeader("x-appwrite-key")
  if (!endpoint || !project || !key) return null
  const sdk = new Client().setEndpoint(endpoint).setProject(project).setKey(key)
  return { storage: new Storage(sdk), functions: new Functions(sdk) }
}

export async function startJob(question: string): Promise<Job> {
  const id = randomBytes(5).toString("hex")
  const job: Job = { id, question, state: "asking", done: -1, total: answerers.length }
  const remote = appwrite()
  if (remote) {
    const execution = await remote.functions.createExecution({ functionId: FUNCTION, body: JSON.stringify({ id, question }), async: true })
    return { ...job, executionId: execution.$id }
  }

  job.done = 0
  jobs.set(id, job)
  generateCustomGame(id, question, {
    onProgress: (done) => {
      job.done = done
    },
    onJudging: () => {
      job.state = "judging"
    },
  })
    .then(async (game) => {
      await mkdir(DIR, { recursive: true })
      await writeFile(join(DIR, `${id}.json`), `${JSON.stringify(game, null, 2)}\n`)
      job.state = "done"
    })
    .catch((error: unknown) => {
      job.state = "failed"
      job.error = error instanceof Error ? error.message : String(error)
    })
  return job
}

export async function getJob(id: string, executionId?: string): Promise<Job | null> {
  const remote = appwrite()
  if (!remote || !executionId) return jobs.get(id) ?? null

  const execution = await remote.functions.getExecution({ functionId: FUNCTION, executionId })
  const base: Job = { id, question: "", state: "asking", done: -1, total: answerers.length, executionId }
  if (execution.status === "failed") return { ...base, state: "failed", error: "Funkce, která se ptá AI, selhala. Podrobnosti jsou v logu funkce v Appwrite." }
  if (execution.status !== "completed") return base
  return (await loadCustom(id)) ? { ...base, state: "done" } : { ...base, state: "failed", error: "Funkce doběhla, ale hra se neuložila." }
}

export async function loadCustom(id: string): Promise<CustomGame | null> {
  if (!CUSTOM_ID.test(id)) return null
  const remote = appwrite()
  try {
    if (remote) {
      const data = await remote.storage.getFileDownload({ bucketId: BUCKET, fileId: id })
      return JSON.parse(new TextDecoder().decode(data)) as CustomGame
    }
    return JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8")) as CustomGame
  } catch {
    return null
  }
}

export async function listCustom(): Promise<Array<CustomGame>> {
  const remote = appwrite()
  let ids: Array<string>
  if (remote) {
    const { files } = await remote.storage.listFiles({ bucketId: BUCKET, queries: [Query.orderDesc("$createdAt"), Query.limit(100)] })
    ids = files.map((f) => f.$id)
  } else {
    try {
      ids = (await readdir(DIR)).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -".json".length))
    } catch {
      return []
    }
  }
  const games = await Promise.all(ids.map(loadCustom))
  return games.filter((g): g is CustomGame => g !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteCustom(id: string): Promise<void> {
  if (!CUSTOM_ID.test(id)) return
  const remote = appwrite()
  if (remote) await remote.storage.deleteFile({ bucketId: BUCKET, fileId: id })
  else await rm(join(DIR, `${id}.json`), { force: true })
}
