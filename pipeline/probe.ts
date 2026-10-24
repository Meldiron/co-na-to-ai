import type { OpenRouter } from "@openrouter/sdk"
import type { Model } from "@openrouter/sdk/models"
import { answerers, personas } from "../src/lib/cast.ts"
import { looseKey } from "../src/lib/match.ts"
import type { Answerer } from "../src/lib/types.ts"
import { askAll, type RawResponse } from "./ask.ts"
import { catalogue, client } from "./lib/openrouter.ts"
import { SPARES } from "./lib/roster.ts"

export const PROBE_SIZE = 15
export const PROBE_MAX_SHARE = 0.5
export const PROBE_MIN_ANSWERED = 10
export const PROBE_MAX_SPREAD = 0.85
export const FINALE_MAX_SHARE = 0.6

export type Tally = { answered: number; top: string; share: number; distinct: number; answers: Array<[string, number]> }
export type Probe = Tally & { costUsd: number }

export function probeAnswerers(all: Array<Answerer>): Array<Answerer> {
  const step = all.length / PROBE_SIZE
  return Array.from({ length: Math.min(PROBE_SIZE, all.length) }, (_, i) => all[Math.floor(i * step)])
}

export function tally(raws: Array<string | null>): Tally {
  const groups = new Map<string, Map<string, number>>()
  for (const raw of raws) {
    if (!raw?.trim()) continue
    const key = looseKey(raw)
    const spellings = groups.get(key) ?? new Map<string, number>()
    spellings.set(raw.trim(), (spellings.get(raw.trim()) ?? 0) + 1)
    groups.set(key, spellings)
  }
  const answers = [...groups.values()]
    .map((spellings): [string, number] => {
      const shown = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return [shown, [...spellings.values()].reduce((a, b) => a + b, 0)]
    })
    .sort((a, b) => b[1] - a[1])
  const answered = answers.reduce((sum, [, n]) => sum + n, 0)
  const [top, count] = answers[0] ?? ["", 0]
  return { answered, top, share: answered ? count / answered : 0, distinct: answers.length, answers }
}

export function dominated(result: Pick<Tally, "answered" | "share">): boolean {
  return result.answered >= PROBE_MIN_ANSWERED && result.share >= PROBE_MAX_SHARE
}

export function scattered(result: Pick<Tally, "answered" | "distinct">): boolean {
  return result.answered >= PROBE_MIN_ANSWERED && result.distinct >= result.answered * PROBE_MAX_SPREAD
}

export function verdict(result: Tally): string | null {
  if (dominated(result)) return `${result.top} má ${Math.round(result.share * 100)} %`
  if (scattered(result)) return `${result.distinct} různých odpovědí z ${result.answered}`
  return null
}

export function finaleVerdict(result: Tally): string | null {
  if (result.answered >= PROBE_MIN_ANSWERED && result.share > FINALE_MAX_SHARE) return `${result.top} má ${Math.round(result.share * 100)} %`
  if (scattered(result)) return `${result.distinct} různých odpovědí z ${result.answered}`
  return null
}

export async function probe(question: string, setup?: { sdk: OpenRouter; models: Map<string, Model> }): Promise<Probe> {
  const sdk = setup?.sdk ?? client()
  const models = setup?.models ?? (await catalogue())
  const responses: Array<RawResponse> = await askAll({
    sdk,
    catalogue: models,
    answerers: probeAnswerers(answerers),
    personas: new Map(personas.map((p) => [p.id, p])),
    spares: SPARES.filter((s) => !answerers.some((a) => a.model === s)),
    question,
  })
  const costUsd = responses.flatMap((r) => r.attempts).reduce((sum, a) => sum + a.costUsd, 0)
  return { ...tally(responses.map((r) => r.raw)), costUsd }
}
