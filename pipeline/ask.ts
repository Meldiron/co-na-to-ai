import type { OpenRouter } from "@openrouter/sdk"
import type { ChatRequest, Model } from "@openrouter/sdk/models"
import pLimit from "p-limit"
import { z } from "zod"
import type { Answerer, Persona } from "../src/lib/types.ts"
import { supports } from "./lib/openrouter.ts"

export const TEMPERATURE = 0.9
const CONCURRENCY = 16
const TIMEOUT_MS = 90_000

export type Attempt = {
  model: string
  mode: "structured" | "plain"
  ok: boolean
  error?: string
  latencyMs: number
  costUsd: number
  promptTokens: number
  completionTokens: number
}

export type RawResponse = {
  answerer: string
  persona: string
  model: string | null
  raw: string | null
  attempts: Array<Attempt>
}

const AnswerSchema = z.object({ odpoved: z.string().min(1) })

export function systemPrompt(persona: Persona, structured: boolean): string {
  return [
    `Jsi ${persona.name}, je ti ${persona.age} let. Bydliště: ${persona.town}, ${persona.region}. Povolání: ${persona.occupation}.`,
    persona.bio,
    `Jak odpovídáš: ${persona.voice}.`,
    "",
    "Hraješ televizní anketu, kde se ptáme stovky lidí. Odpověz za sebe, jako tato osoba, tím, co tě napadne jako první.",
    "Pravidla odpovědi:",
    "- jedna odpověď o 1 až 3 slovech, česky, se správnou diakritikou",
    "- žádné vysvětlení, žádná věta, žádný výčet",
    "- pokud to jde, podstatné jméno v 1. pádě",
    structured
      ? 'Vrať pouze JSON ve tvaru {"odpoved": "…"}.'
      : "Napiš jen samotnou odpověď, nic dalšího.",
  ].join("\n")
}

function request(model: Model | undefined, id: string, persona: Persona, question: string, structured: boolean): ChatRequest & { stream: false } {
  const reasoning = supports(model, "reasoning")
  const req: ChatRequest & { stream: false } = {
    stream: false,
    model: id,
    temperature: TEMPERATURE,
    maxTokens: reasoning ? 2000 : 60,
    messages: [
      { role: "system", content: systemPrompt(persona, structured) },
      { role: "user", content: `Otázka: ${question}` },
    ],
  }
  if (reasoning) req.reasoning = { effort: "minimal" }
  if (structured) {
    req.responseFormat = {
      type: "json_schema",
      jsonSchema: {
        name: "odpoved",
        strict: true,
        schema: {
          type: "object",
          properties: { odpoved: { type: "string", description: "1 až 3 slova česky" } },
          required: ["odpoved"],
          additionalProperties: false,
        },
      },
    }
    req.provider = { requireParameters: true }
  }
  return req
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content.map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : "")).join("")
  }
  return ""
}

function stripFence(text: string): string {
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i)
  return fenced ? fenced[1].trim() : text
}

function parseAnswer(text: string, structured: boolean): string | null {
  const trimmed = stripFence(text.trim())
  if (!trimmed) return null
  if (!structured) return trimmed
  try {
    const parsed = AnswerSchema.safeParse(JSON.parse(trimmed))
    return parsed.success ? parsed.data.odpoved.trim() || null : null
  } catch {
    return null
  }
}

async function attempt(
  sdk: OpenRouter,
  catalogue: Map<string, Model>,
  modelId: string,
  persona: Persona,
  question: string,
  structured: boolean,
): Promise<{ attempt: Attempt; raw: string | null }> {
  const started = Date.now()
  const base: Attempt = {
    model: modelId,
    mode: structured ? "structured" : "plain",
    ok: false,
    latencyMs: 0,
    costUsd: 0,
    promptTokens: 0,
    completionTokens: 0,
  }
  try {
    const result = await sdk.chat.send(
      { chatRequest: request(catalogue.get(modelId), modelId, persona, question, structured) },
      {
        timeoutMs: TIMEOUT_MS,
        retries: {
          strategy: "backoff",
          backoff: { initialInterval: 1000, maxInterval: 8000, exponent: 1.8, maxElapsedTime: 30_000 },
          retryConnectionErrors: true,
        },
      },
    )
    const usage = result.usage
    const raw = parseAnswer(contentText(result.choices[0]?.message.content), structured)
    return {
      raw,
      attempt: {
        ...base,
        ok: raw !== null,
        error: raw === null ? `unparseable: ${contentText(result.choices[0]?.message.content).slice(0, 120)}` : undefined,
        latencyMs: Date.now() - started,
        costUsd: usage?.cost ?? 0,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
      },
    }
  } catch (error) {
    return {
      raw: null,
      attempt: { ...base, latencyMs: Date.now() - started, error: String(error instanceof Error ? error.message : error).slice(0, 300) },
    }
  }
}

export async function askAll(opts: {
  sdk: OpenRouter
  catalogue: Map<string, Model>
  answerers: Array<Answerer>
  personas: Map<string, Persona>
  spares: Array<string>
  question: string
  onProgress?: (done: number, total: number) => void
}): Promise<Array<RawResponse>> {
  const { sdk, catalogue, answerers, personas, question } = opts
  const spares = opts.spares.filter((id) => catalogue.has(id))
  const limit = pLimit(CONCURRENCY)
  let done = 0

  const askOne = async (answerer: Answerer): Promise<RawResponse> => {
    const persona = personas.get(answerer.persona)
    if (!persona) throw new Error(`Unknown persona ${answerer.persona}`)
    const attempts: Array<Attempt> = []
    const queue = catalogue.has(answerer.model) ? [answerer.model] : []

    for (let tries = 0; tries < 2; tries++) {
      if (!queue[tries]) {
        const spare = spares.shift()
        if (!spare) break
        queue.push(spare)
      }
      const modelId = queue[tries]
      const modes = supports(catalogue.get(modelId), "structured_outputs") ? [true, false] : [false]
      for (const structured of modes) {
        const { attempt: a, raw } = await attempt(sdk, catalogue, modelId, persona, question, structured)
        attempts.push(a)
        if (raw) return { answerer: answerer.id, persona: persona.id, model: modelId, raw, attempts }
      }
    }
    return { answerer: answerer.id, persona: persona.id, model: null, raw: null, attempts }
  }

  return Promise.all(
    answerers.map((a) =>
      limit(async () => {
        const response = await askOne(a)
        opts.onProgress?.(++done, answerers.length)
        return response
      }),
    ),
  )
}
