import type { OpenRouter } from "@openrouter/sdk"
import type { RawResponse } from "./ask.ts"
import { resolveAliases, writeAliases } from "./aliases.ts"
import { BOARD_SIZE, gate, group } from "./build.ts"
import { judge } from "./cluster.ts"
import { review, withoutRejected } from "./review.ts"

export async function finalize(sdk: OpenRouter, question: string, responses: Array<RawResponse>, opts: { aliasesOnFail?: boolean } = {}) {
  const answered = responses.filter((r) => r.raw !== null)
  const raws = answered.map((r) => r.raw ?? "")
  const { judgement: clustered, costUsd: clusterCost } = await judge(sdk, question, raws)
  const { rejected, costUsd: reviewCost } = await review(
    sdk,
    question,
    clustered.clusters.map((c) => ({ canonical: c.canonical, examples: c.members.map((i) => raws[i]) })),
  )
  const judgement = withoutRejected(clustered, rejected)
  const judgeCost = clusterCost + reviewCost
  const grouped = group(responses, judgement)
  const verdict = gate(grouped, answered.length, judgement)
  if (!verdict.passed && !opts.aliasesOnFail) return { judgement, grouped, gate: verdict, costUsd: judgeCost }

  const board = grouped.slice(0, BOARD_SIZE)
  const outside = [...grouped.slice(BOARD_SIZE).map((g) => g.canonical), ...judgement.rejected.map((r) => r.canonical)]
  const rawOf = new Map(answered.map((r) => [r.answerer, r.raw ?? ""]))
  const { answers, costUsd: aliasCost } = await writeAliases(
    sdk,
    question,
    board.map((g) => ({ canonical: g.canonical, examples: g.answerers.map((a) => rawOf.get(a) ?? "") })),
    outside,
  )
  const merged = resolveAliases(
    board.map((g) => g.canonical),
    board.map((g) => ({ canonical: g.canonical, accept: [...g.aliases, ...(answers.find((a) => a.canonical === g.canonical)?.accept ?? [])] })),
    outside,
  )
  for (const g of board) g.aliases = merged.get(g.canonical) ?? []
  return { judgement, grouped, gate: verdict, costUsd: judgeCost + aliasCost }
}
