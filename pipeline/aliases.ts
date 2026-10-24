import type { OpenRouter } from "@openrouter/sdk"
import { z } from "zod"
import { looseKey } from "../src/lib/match.ts"
import { JUDGE_MODEL } from "./cluster.ts"

const AliasSchema = z.object({
  answers: z.array(z.object({ canonical: z.string(), accept: z.array(z.string()) })),
})

const jsonSchema = z.toJSONSchema(AliasSchema, { target: "draft-7" })
delete jsonSchema.$schema

const INSTRUCTIONS = `You prepare the answer key for a Czech survey game in the style of Family Feud. The player sees the question and types guesses; a guess reveals a board answer when it matches one of that answer's accepted words. Matching already ignores case, diacritics, i/y mistakes and small typos, so do not list spelling variants.

For each board answer, list every word or short phrase (lowercase Czech) a player might type while thinking of that answer:
- all common grammatical forms: singular and plural, the cases a player might type (e.g. "pivo", "piva", "pivko", "pivka"),
- diminutives, colloquial and slang words ("lahváč", "chlast", "noťas"),
- close synonyms and brand or product names people use for it ("plzeň", "kofola" if the answer is a soft drink),
- concrete examples that clearly belong to it ("kladivo", "pila" for Nářadí; "svetr", "bunda" for Oblečení),
- broader umbrella words and related words a player would naturally type meaning this answer: "alkohol", "chlast", "pití" for Pivo; "jídlo", "svačina" for Chleba when no food answer is on the board. Outside answers do NOT block umbrella words: "alkohol" goes to Pivo even though Slivovice (an outside answer) is also alcohol, because Pivo is the alcohol on the board.

Never list a word under two board answers; give it to the answer a typical player most likely means. Outside answers only block their own names and their own synonyms ("slivovice", "pálenka" must stay wrong). Aim for 20 to 45 entries per answer.`

export async function writeAliases(
  sdk: OpenRouter,
  question: string,
  board: Array<{ canonical: string; examples: Array<string> }>,
  outside: Array<string>,
): Promise<{ answers: Array<{ canonical: string; accept: Array<string> }>; costUsd: number }> {
  const listing = board.map((b, i) => `${i + 1}. ${b.canonical} (respondents wrote: ${[...new Set(b.examples)].slice(0, 12).join(", ")})`).join("\n")
  const result = await sdk.chat.send(
    {
      chatRequest: {
        model: JUDGE_MODEL,
        temperature: 0,
        maxTokens: 12_000,
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: INSTRUCTIONS },
          {
            role: "user",
            content: `Question: ${question}\n\nBoard answers:\n${listing}\n\nOutside answers (not on the board, a guess of these must stay wrong): ${outside.join(", ") || "none"}`,
          },
        ],
        responseFormat: { type: "json_schema", jsonSchema: { name: "answer_key", strict: true, schema: jsonSchema } },
      },
    },
    { timeoutMs: 240_000 },
  )
  const content = result.choices[0]?.message.content
  const parsed = AliasSchema.safeParse(typeof content === "string" ? JSON.parse(content) : null)
  if (!parsed.success) throw new Error("Alias writer returned an unexpected shape")
  return { answers: parsed.data.answers, costUsd: result.usage?.cost ?? 0 }
}

export function resolveAliases(
  canonicals: Array<string>,
  answers: Array<{ canonical: string; accept: Array<string> }>,
  outside: Array<string>,
): Map<string, Array<string>> {
  const taken = new Set([...canonicals, ...outside].map(looseKey))
  const out = new Map(canonicals.map((c) => [c, [] as Array<string>]))
  for (const canonical of canonicals) {
    const entry = answers.find((a) => looseKey(a.canonical) === looseKey(canonical))
    for (const word of entry?.accept ?? []) {
      const key = looseKey(word)
      if (!key || taken.has(key)) continue
      taken.add(key)
      out.get(canonical)?.push(word.trim().toLowerCase())
    }
  }
  return out
}
