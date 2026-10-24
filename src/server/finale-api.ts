import { createServerFn } from "@tanstack/react-start"
import { notFound } from "@tanstack/react-router"
import { z } from "zod"
import { FINALE_GOAL, FINALE_SLOTS, isFinaleWeek } from "@/lib/finale"
import { appwrite } from "./appwrite"
import { answerFinale, currentWeek, finaleLeaderboard, finaleResults, finaleState, finaleWeeks, loadFinale, startFinale } from "./finale"
import { currentSession, ensureSession } from "./session"

const week = z.object({ week: z.string().max(10).optional() })
const answer = z.object({ week: z.string().max(10), slot: z.number().int().min(0).max(FINALE_SLOTS - 1), text: z.string().max(40) })

function resolve(requested: string | undefined): string {
  const current = currentWeek()
  const target = requested ?? current
  if (!isFinaleWeek(target, current)) throw notFound()
  return target
}

async function questionsFor(target: string) {
  const questions = await loadFinale(target)
  if (!questions) throw new Error("Finále ještě není připravené.")
  return questions
}

export const getFinale = createServerFn({ method: "GET" })
  .validator(week)
  .handler(async ({ data }) => {
    const target = resolve(data.week)
    if (!appwrite()) return { week: target, current: target === currentWeek(), enabled: false, ready: false, past: [] as Array<string> }
    const [questions, weeks] = await Promise.all([loadFinale(target), finaleWeeks()])
    return { week: target, current: target === currentWeek(), enabled: true, ready: !!questions, past: weeks.filter((w) => w !== target) }
  })

export const getFinaleState = createServerFn({ method: "GET" })
  .validator(week)
  .handler(async ({ data }) => {
    const target = resolve(data.week)
    const session = await currentSession()
    return finaleState(session?.user.$id ?? null, target, await questionsFor(target))
  })

export const startFinaleGame = createServerFn({ method: "POST" })
  .validator(week)
  .handler(async ({ data }) => {
    const target = resolve(data.week)
    const questions = await questionsFor(target)
    const session = await ensureSession()
    return startFinale(session.user.$id, target, questions)
  })

export const answerFinaleQuestion = createServerFn({ method: "POST" })
  .validator(answer)
  .handler(async ({ data }) => {
    const target = resolve(data.week)
    const questions = await questionsFor(target)
    const session = await currentSession()
    if (!session) throw new Error("Finále se nepodařilo uložit.")
    return answerFinale(session.user.$id, target, questions, data.slot, data.text)
  })

export const getMyFinales = createServerFn({ method: "GET" }).handler(async () => {
  const session = await currentSession()
  return session ? finaleResults(session.user.$id) : null
})

export const getFinaleLeaderboard = createServerFn({ method: "GET" })
  .validator(week)
  .handler(async ({ data }) => {
    const target = resolve(data.week)
    const session = await currentSession()
    return finaleLeaderboard(target, FINALE_GOAL, session?.user.$id ?? null)
  })
