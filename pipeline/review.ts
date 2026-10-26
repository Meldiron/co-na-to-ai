import type { OpenRouter } from "@openrouter/sdk"
import { z } from "zod"
import { JUDGE_MODEL, type Judgement } from "./cluster.ts"

const ReviewSchema = z.object({
  rejected: z.array(z.object({ answer: z.number(), reason: z.string() })),
})

export type Rejection = { canonical: string; votes: number; reason: string }

const jsonSchema = z.toJSONSchema(ReviewSchema, { target: "draft-7" })
delete jsonSchema.$schema

const INSTRUCTIONS = `You check the answers of a Czech survey game in the style of Family Feud before they go on the board. About 100 respondents answered one question with one word each, and their answers have been grouped. A player reads the question and guesses the most common answers, so every answer on the board must be a real answer to the question.

Reject an answer when a player would call it a non-answer:
- it repeats the question or names what the question asks about instead of answering it. "Jaký kabát nebo bundu nosíte v zimě?" asks which kind, so "Bunda" and "Kabát" are rejected while "Péřovka", "Parka", "Zimník" or "Teplý" answer it. "Jakou knedlíkovou dobrotu máte nejradši?" rejects "Knedlíky"; "Které hodiny zapomínáte přeřídit?" rejects "Hodiny"; "Co děláte, když čekáte na vlak?" rejects "Čekám";
- it is the category the question asks for a member of: "Oblečení" for "Co si vezmete na sebe do posilovny?", "Jídlo" for "Jaké jídlo si ohřejete v mikrovlnce?";
- it is a catch-all that names nothing: "Věci", "Něco", "Všechno", "Cokoliv";
- it makes no sense as an answer to this question.

Keep every answer that does answer the question, even a broad, rare, odd or funny one: "Jídlo" for "Co si berete s sebou na chatu?" stays, "Bordel" for "Co najdete v šuplíku?" stays. When unsure, keep it.

List only the rejected answers, by their number, each with one short English reason.`

export async function review(
  sdk: OpenRouter,
  question: string,
  answers: Array<{ canonical: string; examples: Array<string> }>,
): Promise<{ rejected: Map<number, string>; costUsd: number }> {
  const listing = answers.map((a, i) => `${i}: ${a.canonical} (${a.examples.length}×; respondents wrote: ${[...new Set(a.examples)].slice(0, 8).join(", ")})`).join("\n")
  const result = await sdk.chat.send(
    {
      chatRequest: {
        model: JUDGE_MODEL,
        temperature: 0,
        maxTokens: 8_000,
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: INSTRUCTIONS },
          { role: "user", content: `Question: ${question}\n\nAnswers (number: answer):\n${listing}` },
        ],
        responseFormat: { type: "json_schema", jsonSchema: { name: "review", strict: true, schema: jsonSchema } },
      },
    },
    { timeoutMs: 240_000 },
  )
  const content = result.choices[0]?.message.content
  const parsed = ReviewSchema.safeParse(typeof content === "string" ? JSON.parse(content) : null)
  if (!parsed.success) throw new Error("Review returned an unexpected shape")
  return {
    rejected: new Map(parsed.data.rejected.filter((r) => answers[r.answer]).map((r) => [r.answer, r.reason])),
    costUsd: result.usage?.cost ?? 0,
  }
}

export function withoutRejected(judgement: Judgement, rejected: Map<number, string>): Judgement & { rejected: Array<Rejection> } {
  return {
    ...judgement,
    clusters: judgement.clusters.filter((_, i) => !rejected.has(i)),
    invalid: [...judgement.invalid, ...judgement.clusters.filter((_, i) => rejected.has(i)).flatMap((c) => c.members)],
    rejected: judgement.clusters.flatMap((c, i) => (rejected.has(i) ? [{ canonical: c.canonical, votes: c.members.length, reason: rejected.get(i) ?? "" }] : [])),
  }
}
