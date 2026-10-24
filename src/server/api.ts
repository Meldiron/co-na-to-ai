import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { isValidDate, pragueDate } from "@/lib/day"
import { loadPuzzle, summaries, toPayload } from "./puzzles"

export const getPuzzle = createServerFn({ method: "GET" })
  .validator(z.object({ date: z.string().optional() }))
  .handler(async ({ data }) => {
    const today = pragueDate()
    const date = data.date ?? today
    if (!isValidDate(date) || date > today) return { today, date, puzzle: null }
    const puzzle = await loadPuzzle(date)
    return { today, date, puzzle: puzzle ? toPayload(puzzle) : null }
  })

export const getArchive = createServerFn({ method: "GET" }).handler(async () => {
  const today = pragueDate()
  return { today, puzzles: await summaries(today) }
})
