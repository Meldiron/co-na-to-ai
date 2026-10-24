import { answerers, personas } from "../src/lib/cast.ts"
import type { Puzzle } from "../src/lib/types.ts"
import { askAll } from "./ask.ts"
import { buildPuzzle, type GateResult } from "./build.ts"
import { JUDGE_MODEL } from "./cluster.ts"
import { finalize } from "./finalize.ts"
import { catalogue, client } from "./lib/openrouter.ts"
import { SPARES } from "./lib/roster.ts"

export type GenerateHooks = { onProgress?: (done: number) => void; onJudging?: () => void }

export async function generatePuzzle(
  input: { date: string; number: number; questionId: string; question: string; aliasesOnFail?: boolean },
  hooks: GenerateHooks = {},
): Promise<{ puzzle: Puzzle; gate: GateResult }> {
  const sdk = client()
  const models = await catalogue()
  const started = Date.now()
  const responses = await askAll({
    sdk,
    catalogue: models,
    answerers,
    personas: new Map(personas.map((p) => [p.id, p])),
    spares: SPARES.filter((s) => !answerers.some((a) => a.model === s)),
    question: input.question,
    onProgress: hooks.onProgress,
  })
  hooks.onJudging?.()
  const askCost = responses.flatMap((r) => r.attempts).reduce((sum, a) => sum + a.costUsd, 0)
  const { grouped, gate, costUsd } = await finalize(sdk, input.question, responses, { aliasesOnFail: input.aliasesOnFail })
  const puzzle = buildPuzzle({
    date: input.date,
    number: input.number,
    questionId: input.questionId,
    question: input.question,
    responses,
    grouped,
    judgeModel: JUDGE_MODEL,
    costUsd: askCost + costUsd,
    durationMs: Date.now() - started,
  })
  return { puzzle, gate }
}
