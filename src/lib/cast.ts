import answerersJson from "../../data/answerers.json"
import modelsJson from "../../data/models.json"
import personasJson from "../../data/personas.json"
import type { Answerer, ModelInfo, Persona } from "./types"

export const personas = personasJson as Array<Persona>
export const models = modelsJson as Array<ModelInfo>
export const answerers = answerersJson as Array<Answerer>

const personaById = new Map(personas.map((p) => [p.id, p]))
const modelById = new Map(models.map((m) => [m.id, m]))

export function personaOf(id: string): Persona | undefined {
  return personaById.get(id)
}

export function modelOf(id: string): ModelInfo {
  return modelById.get(id) ?? { id, name: id.split("/").pop() ?? id, provider: id.split("/")[0] ?? "" }
}

export function firstName(persona: Persona): string {
  return persona.name.split(" ")[0]
}

export const providerCount = new Set(answerers.map((a) => modelOf(a.model).provider)).size
