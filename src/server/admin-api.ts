import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { pragueDate } from "@/lib/day"
import { checkPassword, endSession, isAdmin, requireAdmin, startSession } from "./auth"
import { deleteCustom, getJob, listCustom, loadCustom, startJob } from "./custom"
import { loadPuzzle, recentSummaries, toPayload } from "./puzzles"

export const getAdminState = createServerFn({ method: "GET" }).handler(async () => {
  if (!isAdmin()) return { authed: false as const }
  const today = pragueDate()
  const puzzle = await loadPuzzle(today)
  const games = await listCustom()
  return {
    authed: true as const,
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
      flags: g.gate.flags,
      top: g.answers.map((a) => [a.text, a.votes] as const),
    })),
  }
})

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().max(200) }))
  .handler(async ({ data }) => {
    if (!checkPassword(data.password)) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      return { ok: false }
    }
    startSession()
    return { ok: true }
  })

export const logout = createServerFn({ method: "POST" }).handler(() => {
  endSession()
  return { ok: true }
})

export const createCustomGame = createServerFn({ method: "POST" })
  .validator(z.object({ question: z.string().trim().min(8).max(90) }))
  .handler(async ({ data }) => {
    requireAdmin()
    return startJob(data.question)
  })

export const getCustomJob = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string(), executionId: z.string().optional() }))
  .handler(async ({ data }) => {
    requireAdmin()
    return getJob(data.id, data.executionId)
  })

export const removeCustomGame = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    requireAdmin()
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
