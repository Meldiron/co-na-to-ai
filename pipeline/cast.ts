import type { Answerer, ModelInfo, Persona } from "../src/lib/types.ts"
import { catalogue } from "./lib/openrouter.ts"
import { PATHS, readJson, writeJson } from "./lib/io.ts"
import { MODELS, PROVIDERS, SPARES } from "./lib/roster.ts"

function seededShuffle<T>(items: Array<T>, seed: number): Array<T> {
  const out = [...items]
  let state = seed
  const next = () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function main() {
  const personas = await readJson<Array<Persona>>(PATHS.personas)
  if (personas.length !== MODELS.length) {
    throw new Error(`Need ${MODELS.length} personas, found ${personas.length}`)
  }
  const known = await catalogue()
  const missing = [...MODELS, ...SPARES].filter((id) => !known.has(id))
  if (missing.length) throw new Error(`Not on OpenRouter: ${missing.join(", ")}`)

  const models: Array<ModelInfo> = [...MODELS, ...SPARES].map((id) => {
    const name = known.get(id)!.name
    return {
      id,
      name: name.includes(": ") ? name.slice(name.indexOf(": ") + 2) : name,
      provider: PROVIDERS[id.split("/")[0]] ?? id.split("/")[0],
    }
  })

  const shuffled = seededShuffle(personas, 2026_10_24)
  const answerers: Array<Answerer> = MODELS.map((model, i) => ({
    id: `a${String(i + 1).padStart(3, "0")}`,
    model,
    persona: shuffled[i].id,
  }))

  await writeJson(PATHS.models, models)
  await writeJson(PATHS.answerers, answerers)
  console.log(`Cast: ${answerers.length} answerers, ${models.length} models (${SPARES.length} spares)`)
}

await main()
