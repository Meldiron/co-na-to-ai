import type { OpenRouter } from "@openrouter/sdk"
import { z } from "zod"

export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "anthropic/claude-opus-5.5"

const ClusterSchema = z.object({
  canonical: z.string().min(1).max(40),
  members: z.array(z.number().int().nonnegative()),
  aliases: z.array(z.string()),
})

const JudgementSchema = z.object({
  clusters: z.array(ClusterSchema),
  invalid: z.array(z.number().int().nonnegative()),
  offensive: z.boolean(),
  notes: z.string(),
})

export type Judgement = z.infer<typeof JudgementSchema>

const WireSchema = z.object({
  clusters: z.array(z.object({ canonical: z.string(), members: z.array(z.number()), aliases: z.array(z.string()) })),
  invalid: z.array(z.number()),
  offensive: z.boolean(),
  notes: z.string(),
})

const jsonSchema = z.toJSONSchema(WireSchema, { target: "draft-7" })
delete jsonSchema.$schema

const INSTRUCTIONS = `You are the producer of a Czech TV survey game in the style of Family Feud ("5 proti 5"). About 100 respondents answered one survey question in Czech. Group their raw answers into canonical answers for the game board.

Rules:
- Merge answers that a fair game-show producer would count as the same answer: the same thing in other words, inflection, singular or plural, diminutive, spelling mistakes, missing diacritics, with or without an adjective when the core thing is the same ("studené pivo" = "pivo"), a close synonym.
- Merge answers that share a word root or where one is a derived or more specific form of the other: "zákon", "zákony" and "zákoník" are one answer; "právní předpisy" goes with them too when nothing else on the board is about rules; "papír", "papíry" and "papírky" are one answer.
- Do not merge different things just because they share a broad category ("pivo" and "víno" stay apart; "kniha" and "časopis" stay apart). When unsure, ask yourself whether a player who typed one would expect to be credited for the other; if yes, merge.
- Never invent an umbrella cluster out of different specific things: "víno" and "slivovice" do not become "Alkohol"; each stays itself.
- An umbrella answer that a respondent actually gave ("alkohol", "pití", "jídlo", "elektronika") joins the most common specific answer of that kind ("alkohol" joins "Pivo" when pivo is the most common drink). Only when no specific answer of that kind exists does the umbrella answer stay its own cluster.
- If a respondent named several things ("pero a papír", "papíry, počítač"), assign the answer to the item that belongs to the biggest cluster ("pero a papír" counts as "papír" when papír is more common than pero). Never create a cluster for a combination of two things.
- Put an index into "invalid" only when it is a refusal, a non-answer, an answer to a different question, or not understandable. A rare, odd or one-off answer that does answer the question is NOT invalid: it becomes its own cluster, even with a single member. Every index appears exactly once, either in one cluster's "members" or in "invalid".
- "canonical": the board label in Czech, ONE word only, nominative case, first letter capitalised, at most 18 characters ("Pivo", "Repelent", "Oblečení", "Zákony"). Never two words, never "X a Y".
- "aliases": 6 to 25 lowercase Czech forms a player might type that should count as this answer: the canonical word in singular and plural and common cases, diminutives, colloquial words, close synonyms, and the core words of the members. Never include a form that would also fit another cluster.
- Order clusters from most members to fewest.
- "offensive": true if the question or any frequent answer is vulgar, hateful or otherwise unfit for a family game.
- "notes": one short English sentence on any judgement call you made.`

export async function judge(sdk: OpenRouter, question: string, raws: Array<string>): Promise<{ judgement: Judgement; costUsd: number }> {
  const listing = raws.map((raw, i) => `${i}: ${raw}`).join("\n")
  let costUsd = 0
  let lastError = ""

  for (let tries = 0; tries < 3; tries++) {
    const result = await sdk.chat.send(
      {
        chatRequest: {
          model: JUDGE_MODEL,
          temperature: 0,
          maxTokens: 16_000,
          reasoning: { effort: "low" },
          messages: [
            { role: "system", content: INSTRUCTIONS },
            {
              role: "user",
              content: `Question: ${question}\n\nRaw answers (index: answer):\n${listing}${lastError ? `\n\nYour previous attempt was invalid: ${lastError}` : ""}`,
            },
          ],
          responseFormat: {
            type: "json_schema",
            jsonSchema: { name: "judgement", strict: true, schema: jsonSchema },
          },
        },
      },
      { timeoutMs: 240_000 },
    )
    costUsd += result.usage?.cost ?? 0
    const content = result.choices[0]?.message.content
    const parsed = JudgementSchema.safeParse(typeof content === "string" ? safeJson(content) : null)
    if (!parsed.success) {
      lastError = `the JSON did not match the schema (${parsed.error.issues[0]?.message ?? "unknown"})`
      continue
    }
    const coverageError = checkCoverage(parsed.data, raws.length)
    if (!coverageError) return { judgement: parsed.data, costUsd }
    lastError = coverageError
  }
  throw new Error(`Judge failed after 3 attempts: ${lastError}`)
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function checkCoverage(judgement: Judgement, count: number): string | null {
  const seen = new Map<number, number>()
  for (const index of [...judgement.clusters.flatMap((c) => c.members), ...judgement.invalid]) {
    seen.set(index, (seen.get(index) ?? 0) + 1)
  }
  const missing = Array.from({ length: count }, (_, i) => i).filter((i) => !seen.has(i))
  const doubled = [...seen].filter(([, n]) => n > 1).map(([i]) => i)
  const outOfRange = [...seen.keys()].filter((i) => i >= count)
  if (!missing.length && !doubled.length && !outOfRange.length) return null
  return [
    missing.length ? `indices missing: ${missing.join(", ")}` : "",
    doubled.length ? `indices used twice: ${doubled.join(", ")}` : "",
    outOfRange.length ? `indices out of range: ${outOfRange.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ")
}
