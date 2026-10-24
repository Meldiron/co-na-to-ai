import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { pragueDate } from "@/lib/day"
import { gateReasons } from "@/lib/gate-text"
import { deleteCustom, getJob, listCustom, loadCustom, startJob } from "./custom"
import { loadPuzzle, recentSummaries, summaries, toPayload } from "./puzzles"
import { questionBank, refillStatus, reviewQuestion, startRefill } from "./question-bank"
import { currentSession, isAdmin, requireAdmin } from "./session"

export const getAdminState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await currentSession()
  if (!isAdmin(session?.user)) return { authed: false as const, member: !!session?.user.email }
  const today = pragueDate()
  const puzzle = await loadPuzzle(today)
  const games = await listCustom()
  return {
    authed: true as const,
    days: (await summaries(today)).slice(0, 30).map((s) => ({ date: s.date, question: s.question })),
    bank: await questionBank(),
    today: puzzle
      ? { date: puzzle.date, question: puzzle.question, asked: puzzle.asked, answered: puzzle.answered, meta: puzzle.meta, top: puzzle.answers.map((a) => [a.text, a.votes] as const) }
      : null,
    games: games.map((g) => ({
      id: g.id,
      question: g.question,
      createdAt: g.createdAt,
      answered: g.answered,
      costUsd: g.meta.costUsd,
      passed: g.gate.passed,
      flags: gateReasons(g.gate, g.answers[0]?.text),
      top: g.answers.map((a) => [a.text, a.votes] as const),
    })),
  }
})

export const createCustomGame = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(8).max(90) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    return startJob(data.question)
  })

export const getCustomJob = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string(), executionId: z.string().optional() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    return getJob(data.id, data.executionId)
  })

export const removeCustomGame = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await deleteCustom(data.id)
    return { ok: true }
  })

export const getCustomPuzzle = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const game = await loadCustom(data.id)
    const today = pragueDate()
    return { today, puzzle: game ? toPayload(game, "custom", game.id) : null, recent: await recentSummaries(today, "") }
  })

export const reviewBankQuestion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().max(36), decision: z.enum(["approved", "rejected"]) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    await reviewQuestion(data.id, data.decision)
    return { ok: true }
  })

export const refillBank = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin()
  return { executionId: await startRefill() }
})

export const getRefill = createServerFn({ method: "GET" })
  .validator(z.object({ executionId: z.string().max(36) }))
  .handler(async ({ data }) => {
    await requireAdmin()
    return { status: await refillStatus(data.executionId) }
  })
