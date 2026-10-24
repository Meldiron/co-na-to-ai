import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { isValidDate, pragueDate } from "@/lib/day"
import { appwrite } from "./appwrite"
import { finaleWeeks } from "./finale"
import { loadPuzzle, recentSummaries, summaries, toPayload } from "./puzzles"

export const getPuzzle = createServerFn({ method: "GET" })
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }) => {
    const today = pragueDate()
    const date = data.date ?? today
    const recent = await recentSummaries(today, date)
    if (!isValidDate(date) || date > today) return { today, date, puzzle: null, recent }
    const puzzle = await loadPuzzle(date)
    return { today, date, puzzle: puzzle ? toPayload(puzzle) : null, recent }
  })

export const getArchive = createServerFn({ method: "GET" }).handler(async () => {
  const today = pragueDate()
  const finales = appwrite()
    ? await finaleWeeks().catch((error: unknown) => {
        console.error("Could not list finále weeks:", error)
        return []
      })
    : []
  return { today, puzzles: await summaries(today), finales }
})
