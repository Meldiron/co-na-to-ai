import { pragueDate } from "../src/lib/day.ts"
import type { Puzzle } from "../src/lib/types.ts"
import type { GateResult } from "./build.ts"
import { generatePuzzle, type GenerateHooks } from "./generate.ts"

export type CustomGame = Puzzle & { id: string; createdAt: string; gate: GateResult }

export const CUSTOM_ID = /^[a-f0-9]{10}$/

export async function generateCustomGame(id: string, question: string, hooks: GenerateHooks = {}): Promise<CustomGame> {
  const { puzzle, gate } = await generatePuzzle({ date: pragueDate(), number: 0, questionId: id, question, aliasesOnFail: true }, hooks)
  return { ...puzzle, id, createdAt: new Date().toISOString(), gate }
}
