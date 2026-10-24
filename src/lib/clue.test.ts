import { describe, expect, it } from "vitest"
import { personaClue } from "./clue"
import type { Persona } from "./types"

const person = (age: number, gender: "f" | "m", region: string, occupation = "důchodce"): Persona => ({
  id: `${age}-${gender}-${region}`,
  name: gender === "f" ? "Jana Testová" : "Petr Test",
  age,
  gender,
  town: "Brno",
  region,
  occupation,
  bio: "",
  voice: "",
})

describe("personaClue", () => {
  it("names mostly retired Moravians", () => {
    const people = [
      person(70, "m", "Jihomoravský kraj", "bývalý horník"),
      person(75, "f", "Zlínský kraj", "důchodkyně"),
      person(81, "m", "Olomoucký kraj", "bývalý kloboučník"),
      person(34, "m", "Hlavní město Praha", "programátor"),
    ]
    expect(personaClue(people)).toBe("Tohle řekli hlavně důchodci, většinou z Moravy. Nejmladší byl Petr (34, Brno), nejstarší Petr (81, Brno).")
  })

  it("uses the feminine verb for women", () => {
    const people = [person(30, "f", "Hlavní město Praha", "účetní"), person(40, "f", "Hlavní město Praha", "zdravotní sestra"), person(33, "f", "Středočeský kraj", "učitelka")]
    expect(personaClue(people)).toMatch(/^Tohle řekly hlavně ženy mezi 25 a 45, většinou z Prahy\./)
  })

  it("describes a single respondent directly", () => {
    expect(personaClue([person(58, "m", "Ústecký kraj", "chmelař")])).toBe("Tohle řekl jen jeden člověk: chmelař, 58 let, Brno.")
  })

  it("falls back to the whole country when nothing dominates", () => {
    const people = [
      person(20, "f", "Hlavní město Praha"),
      person(40, "m", "Hlavní město Praha"),
      person(60, "f", "Jihomoravský kraj"),
      person(80, "m", "Zlínský kraj"),
      person(50, "f", "Plzeňský kraj"),
    ]
    expect(personaClue(people)).toMatch(/^Tohle řekli lidé všech věků, z celé republiky\./)
  })
})
