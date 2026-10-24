import "@tanstack/react-start/server-only"
import { Query, type Models } from "node-appwrite"
import { BANK_TABLE, POOL_TARGET, type BankRow } from "../../pipeline/bank"
import type { Probe } from "../../pipeline/probe"
import type { Question } from "@/lib/types"
import { DATABASE, appwrite } from "./appwrite"

const files = Object.entries(import.meta.glob<Array<Question>>("../../questions/*.json", { eager: true, import: "default" }))
const bundledReserves = files.filter(([path]) => path.includes("reserve")).flatMap(([, list]) => list)

function tables() {
  const remote = appwrite()
  if (!remote) throw new Error("Appwrite není dostupný.")
  return remote.tables
}

function describe(row: BankRow) {
  const probe = row.probe ? (JSON.parse(row.probe) as Probe) : null
  return {
    id: row.$id,
    text: row.text,
    status: row.status,
    note: row.note,
    usedOn: row.usedOn,
    probe: probe && { answered: probe.answered, share: probe.share, distinct: probe.distinct, answers: probe.answers.slice(0, 6) },
  }
}

export async function questionBank() {
  const [bank, puzzles] = await Promise.all([
    tables().listRows<BankRow>({ databaseId: DATABASE, tableId: BANK_TABLE, queries: [Query.orderDesc("$createdAt"), Query.limit(500)] }),
    tables().listRows<Models.Row & { questionId: string }>({ databaseId: DATABASE, tableId: "puzzles", queries: [Query.select(["questionId"]), Query.limit(5000)] }),
  ])
  const tried = new Set(puzzles.rows.map((r) => r.questionId))
  const candidates = bank.rows.filter((r) => r.status === "candidate")
  return {
    pool: {
      bundled: bundledReserves.filter((q) => q.status === "approved" && !q.date && !tried.has(q.id)).length,
      approved: bank.rows.filter((r) => r.status === "approved").length,
      candidates: candidates.length,
      target: POOL_TARGET,
    },
    candidates: candidates.map(describe),
    recent: bank.rows
      .filter((r) => r.status !== "candidate")
      .slice(0, 12)
      .map(describe),
  }
}

export async function reviewQuestion(id: string, decision: "approved" | "rejected"): Promise<void> {
  await tables().updateRow({ databaseId: DATABASE, tableId: BANK_TABLE, rowId: id, data: { status: decision } })
}

export async function startRefill(): Promise<string> {
  const remote = appwrite()
  if (!remote) throw new Error("Appwrite není dostupný.")
  const execution = await remote.functions.createExecution({ functionId: "maintenance", body: JSON.stringify({ task: "questions", force: true }), async: true })
  return execution.$id
}

export async function refillStatus(executionId: string): Promise<string> {
  const remote = appwrite()
  if (!remote) throw new Error("Appwrite není dostupný.")
  return (await remote.functions.getExecution({ functionId: "maintenance", executionId })).status
}
