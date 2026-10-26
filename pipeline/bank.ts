import type { OpenRouter } from "@openrouter/sdk"
import type { Models } from "node-appwrite"
import { z } from "zod"
import { normalize } from "../src/lib/match.ts"
import type { Question } from "../src/lib/types.ts"
import { JUDGE_MODEL } from "./cluster.ts"

export const BANK_TABLE = "questions"
export const POOL_TARGET = 30
export const DRAFT_COUNT = 20

export type BankStatus = "candidate" | "approved" | "used" | "rejected"
export type BankRow = Models.Row & {
  text: string
  status: BankStatus
  source: "generated" | "admin"
  probe: string | null
  probeShare: number | null
  note: string | null
  usedOn: string | null
}

export function asQuestion(row: Pick<BankRow, "$id" | "text">): Question {
  return { id: row.$id, text: row.text, tags: [], status: "approved" }
}

const DraftSchema = z.object({ questions: z.array(z.object({ text: z.string(), why: z.string() })) })
const draftJsonSchema = z.toJSONSchema(DraftSchema, { target: "draft-7" })
delete draftJsonSchema.$schema

const INSTRUCTIONS = `You write questions for a Czech daily web game modelled on the TV show 5 proti 5 (Family Feud).
One hundred AI models, each playing a different Czech persona (age, region, job), answer every question with ONE Czech word.
Players then try to guess the 8 most common answers.

A good question:
- is natural everyday Czech, under 70 characters, a single sentence ending with "?" (or "Jmenujte …");
- has an open but finite answer space: roughly 8 to 15 answers that several people would give;
- has no single dominant answer: the most common answer must stay well under 45 % ("Co nosíte v dešti?" fails, everyone says deštník);
- is answered with single words, ideally common nouns, not phrases or sentences;
- does not name the answers in its own wording: "Jaký kabát nebo bundu nosíte v zimě?" gets "bunda" and "kabát" back, "Jakou knedlíkovou dobrotu máte nejradši?" gets "knedlíky";
- draws its answers from a shared, everyday set: avoid personal or unbounded answers such as nicknames, song or film titles, names of people, or anything where nearly everyone answers differently;
- is about ordinary Czech life: home, food, family, work, school, shopping, travel, seasons, holidays, hobbies, Czech habits;
- is not political, religious, sexual, offensive or grim, and is not trivia with one correct answer.

Vary the form (Co…, Jaký…, Kam…, Kde…, Čím…, Kdo…, Jmenujte…) and the topics.
Never repeat or closely paraphrase an existing question.`

export function questionKey(text: string): string {
  return normalize(text)
}

function words(text: string): Set<string> {
  return new Set(questionKey(text).split(" ").filter((w) => w.length > 2))
}

export function isDuplicate(text: string, existing: Array<string>): boolean {
  const key = questionKey(text)
  const mine = words(text)
  return existing.some((other) => {
    if (questionKey(other) === key) return true
    const theirs = words(other)
    const shared = [...mine].filter((w) => theirs.has(w)).length
    const union = new Set([...mine, ...theirs]).size
    return union > 0 && shared / union >= 0.75
  })
}

export async function draftQuestions(
  sdk: OpenRouter,
  opts: { count: number; existing: Array<string>; passed: Array<string>; failed: Array<{ text: string; reason: string }> },
): Promise<{ questions: Array<string>; costUsd: number }> {
  const prompt = [
    `Write ${opts.count} new questions.`,
    opts.passed.length ? `These produced good boards:\n${opts.passed.map((q) => `- ${q}`).join("\n")}` : "",
    opts.failed.length ? `These failed, with the reason:\n${opts.failed.map((f) => `- ${f.text} (${f.reason})`).join("\n")}` : "",
    `Existing questions, do not repeat or paraphrase any of them:\n${opts.existing.map((q) => `- ${q}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const result = await sdk.chat.send(
    {
      chatRequest: {
        model: JUDGE_MODEL,
        temperature: 1,
        maxTokens: 8_000,
        reasoning: { effort: "low" },
        messages: [
          { role: "system", content: INSTRUCTIONS },
          { role: "user", content: prompt },
        ],
        responseFormat: { type: "json_schema", jsonSchema: { name: "drafts", strict: true, schema: draftJsonSchema } },
      },
    },
    { timeoutMs: 240_000 },
  )
  const content = result.choices[0]?.message.content
  const parsed = DraftSchema.safeParse(typeof content === "string" ? JSON.parse(content) : null)
  if (!parsed.success) throw new Error(`Draft did not match the schema: ${parsed.error.issues[0]?.message ?? "unknown"}`)

  const kept: Array<string> = []
  for (const { text } of parsed.data.questions) {
    const clean = text.replace(/\s+/g, " ").trim()
    if (clean.length < 10 || clean.length > 90 || isDuplicate(clean, [...opts.existing, ...kept])) continue
    kept.push(clean)
  }
  return { questions: kept, costUsd: result.usage?.cost ?? 0 }
}
