import type { BoardAnswer, OtherAnswer, Puzzle, Response } from "../src/lib/types.ts"
import { normalize } from "../src/lib/match.ts"
import type { RawResponse } from "./ask.ts"
import type { Judgement } from "./cluster.ts"

export const BOARD_SIZE = 8
export const GATE = {
  minAnswered: 80,
  maxTopShare: 0.45,
  minClustersWithTwo: 8,
  minBoardShare: 0.5,
}

export type GateResult = {
  passed: boolean
  answered: number
  topShare: number
  boardShare: number
  clustersWithTwo: number
  flags: Array<string>
}

type Grouped = { canonical: string; aliases: Array<string>; answerers: Array<string> }

export function group(responses: Array<RawResponse>, judgement: Judgement): Array<Grouped> {
  const answered = responses.filter((r) => r.raw !== null)
  return judgement.clusters
    .map((c) => ({
      canonical: c.canonical.trim(),
      aliases: dedupeAliases(c.canonical, c.aliases),
      answerers: c.members.map((i) => answered[i].answerer),
    }))
    .filter((c) => c.answerers.length > 0)
    .sort((a, b) => b.answerers.length - a.answerers.length)
}

function dedupeAliases(canonical: string, aliases: Array<string>): Array<string> {
  const seen = new Set([normalize(canonical)])
  const out: Array<string> = []
  for (const alias of aliases) {
    const key = normalize(alias)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(alias.trim().toLowerCase())
  }
  return out
}

export function gate(grouped: Array<Grouped>, answered: number, judgement: Judgement): GateResult {
  const top = grouped[0]?.answerers.length ?? 0
  const topShare = answered ? top / answered : 0
  const clustersWithTwo = grouped.filter((c) => c.answerers.length >= 2).length
  const onBoard = grouped.slice(0, BOARD_SIZE).reduce((sum, c) => sum + c.answerers.length, 0)
  const boardShare = answered ? onBoard / answered : 0
  const flags: Array<string> = []
  if (answered < GATE.minAnswered) flags.push(`only ${answered} answers (min ${GATE.minAnswered})`)
  if (topShare > GATE.maxTopShare) flags.push(`top answer "${grouped[0].canonical}" has ${Math.round(topShare * 100)} % (max ${GATE.maxTopShare * 100} %)`)
  if (clustersWithTwo < GATE.minClustersWithTwo) flags.push(`only ${clustersWithTwo} answers with 2+ votes (min ${GATE.minClustersWithTwo})`)
  if (boardShare < GATE.minBoardShare) flags.push(`the board holds only ${Math.round(boardShare * 100)} % of answers (min ${GATE.minBoardShare * 100} %)`)
  if (judgement.offensive) flags.push("judge flagged offensive content")
  return { passed: flags.length === 0, answered, topShare, boardShare, clustersWithTwo, flags }
}

export function buildPuzzle(opts: {
  date: string
  number: number
  questionId: string
  question: string
  responses: Array<RawResponse>
  grouped: Array<Grouped>
  judgeModel: string
  costUsd: number
  durationMs: number
}): Puzzle {
  const { responses, grouped } = opts
  const answers: Array<BoardAnswer> = grouped.slice(0, BOARD_SIZE).map((c, i) => ({
    rank: i + 1,
    text: c.canonical,
    votes: c.answerers.length,
    aliases: c.aliases,
    answerers: c.answerers,
  }))
  const others: Array<OtherAnswer> = grouped.slice(BOARD_SIZE).map((c) => ({
    text: c.canonical,
    votes: c.answerers.length,
    answerers: c.answerers,
  }))
  const canonicalOf = new Map(grouped.flatMap((c) => c.answerers.map((a) => [a, c.canonical] as const)))
  const out: Array<Response> = responses.map((r) => ({
    answerer: r.answerer,
    model: r.model ?? r.attempts.at(-1)?.model ?? "",
    persona: r.persona,
    raw: r.raw ?? "",
    answer: canonicalOf.get(r.answerer) ?? null,
  }))
  const answered = responses.filter((r) => r.raw !== null).length

  return {
    date: opts.date,
    number: opts.number,
    questionId: opts.questionId,
    question: opts.question,
    asked: responses.length,
    answered,
    answers,
    others,
    responses: out,
    meta: {
      generatedAt: new Date().toISOString(),
      judgeModel: opts.judgeModel,
      costUsd: Math.round(opts.costUsd * 10_000) / 10_000,
      durationMs: opts.durationMs,
      failed: responses.length - answered,
      clusters: grouped.length,
      topShare: answered ? Math.round((answers[0].votes / answered) * 1000) / 1000 : 0,
    },
  }
}
