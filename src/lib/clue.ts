import type { Persona } from "./types.ts"

const MORAVIA = new Set(["Jihomoravský kraj", "Zlínský kraj", "Olomoucký kraj", "Moravskoslezský kraj", "Kraj Vysočina"])

export type Band = "young" | "adult" | "senior" | "retired"

export function band(age: number): Band {
  if (age <= 25) return "young"
  if (age <= 45) return "adult"
  if (age <= 64) return "senior"
  return "retired"
}

const GROUPS: Record<Band, { f: string; m: string; mixed: string }> = {
  young: { f: "mladé ženy", m: "mladí muži", mixed: "mladí lidé do pětadvaceti" },
  adult: { f: "ženy mezi 25 a 45", m: "muži mezi 25 a 45", mixed: "lidé mezi 25 a 45" },
  senior: { f: "ženy po padesátce", m: "muži po padesátce", mixed: "lidé po padesátce" },
  retired: { f: "důchodkyně", m: "důchodci", mixed: "důchodci" },
}

function dominant<T>(items: Array<T>, share: number): T | null {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  const [top, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  return count / items.length >= share ? top : null
}

export function area(persona: Persona): "Praha" | "Morava" | "Čechy" {
  if (persona.region === "Hlavní město Praha") return "Praha"
  return MORAVIA.has(persona.region) ? "Morava" : "Čechy"
}

const FROM = { Praha: "z Prahy", Morava: "z Moravy", Čechy: "z Čech" }

function who(p: Persona): string {
  return `${p.name.split(" ")[0]} (${p.age}, ${p.town})`
}

function extremes(people: Array<Persona>): string {
  const byAge = [...people].sort((a, b) => a.age - b.age)
  if (people.length === 2) return `Řekli to ${who(byAge[0])} a ${who(byAge[1])}.`
  const youngest = byAge[0]
  const oldest = byAge[byAge.length - 1]
  return `${youngest.gender === "f" ? "Nejmladší byla" : "Nejmladší byl"} ${who(youngest)}, nejstarší ${who(oldest)}.`
}

export function personaClue(people: Array<Persona>): string {
  if (people.length === 0) return "Tuhle odpověď nikdo z dotázaných nedal."
  if (people.length === 1) {
    const [p] = people
    return `Tohle ${p.gender === "f" ? "řekla" : "řekl"} jen jeden člověk: ${p.occupation}, ${p.age} let, ${p.town}.`
  }

  const gender = dominant(people.map((p) => p.gender), 0.7)
  const ageBand = dominant(people.map((p) => band(p.age)), 0.45)
  const place = dominant(people.map(area), 0.5)
  const nearlyAll = (place && people.filter((p) => area(p) === place).length / people.length >= 0.8) || false

  const group = ageBand ? GROUPS[ageBand][gender ?? "mixed"] : gender === "f" ? "ženy" : gender === "m" ? "muži" : "lidé všech věků"
  const verb = gender === "f" ? "řekly" : "řekli"
  const where = place ? ` ${nearlyAll ? (gender === "f" ? "skoro všechny" : "skoro všichni") : "většinou"} ${FROM[place]}` : " z celé republiky"
  const lead = ageBand || gender ? `Tohle ${verb} hlavně ${group}` : `Tohle ${verb} ${group}`
  return `${lead},${where}. ${extremes(people)}`
}
