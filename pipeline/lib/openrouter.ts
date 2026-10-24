import { OpenRouter } from "@openrouter/sdk"
import type { Model } from "@openrouter/sdk/models"

export function client(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set (put it in .env or the environment)")
  return new OpenRouter({
    apiKey,
    httpReferer: "https://github.com/Meldiron/co-na-to-ai",
    appTitle: "Co na to AI",
  })
}

export async function catalogue(): Promise<Map<string, Model>> {
  const sdk = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? "" })
  const out = new Map<string, Model>()
  for await (const page of await sdk.models.list()) {
    for (const model of page.result.data) out.set(model.id, model)
  }
  return out
}

export function supports(model: Model | undefined, parameter: string): boolean {
  return model?.supportedParameters.some((p) => p === parameter) ?? false
}
