import { describe, expect, it } from "vitest"
import { matchGuess, normalize } from "./match"

const answers = [
  { text: "Pivo", aliases: ["piva", "pivko", "pivečko", "lahváč", "plzeň"] },
  { text: "Repelent", aliases: ["repelenty", "sprej na komáry", "autan"] },
  { text: "Teplé oblečení", aliases: ["mikina", "svetr", "teplé věci", "bunda"] },
  { text: "Jahody", aliases: ["jahoda", "jahůdky"] },
  { text: "Čaj", aliases: ["čaje", "čajík"] },
]

describe("normalize", () => {
  it("lowercases, strips diacritics and punctuation", () => {
    expect(normalize("  Teplé  OBLEČENÍ!! ")).toBe("teple obleceni")
    expect(normalize("Řízek, brambory")).toBe("rizek brambory")
    expect(normalize("Kůň")).toBe("kun")
  })
})

describe("matchGuess", () => {
  const none = new Set<number>()

  it("matches the canonical answer regardless of case and diacritics", () => {
    expect(matchGuess("PIVO", answers, none)).toEqual({ kind: "hit", index: 0 })
    expect(matchGuess("teple obleceni", answers, none)).toEqual({ kind: "hit", index: 2 })
    expect(matchGuess("caj", answers, none)).toEqual({ kind: "hit", index: 4 })
  })

  it("matches Czech inflections and diminutives through aliases", () => {
    expect(matchGuess("pivko", answers, none)).toEqual({ kind: "hit", index: 0 })
    expect(matchGuess("jahůdky", answers, none)).toEqual({ kind: "hit", index: 3 })
    expect(matchGuess("lahvac", answers, none)).toEqual({ kind: "hit", index: 0 })
  })

  it("forgives small typos scaled to length", () => {
    expect(matchGuess("repelnet", answers, none)).toEqual({ kind: "hit", index: 1 })
    expect(matchGuess("jahdy", answers, none)).toEqual({ kind: "hit", index: 3 })
    expect(matchGuess("teple obleceny", answers, none)).toEqual({ kind: "hit", index: 2 })
  })

  it("does not stretch short words into other answers", () => {
    expect(matchGuess("caj", answers, none)).toEqual({ kind: "hit", index: 4 })
    expect(matchGuess("cas", answers, none)).toEqual({ kind: "miss" })
    expect(matchGuess("víno", answers, none)).toEqual({ kind: "miss" })
  })

  it("reports an already revealed answer as a repeat, not a strike", () => {
    expect(matchGuess("piva", answers, new Set([0]))).toEqual({ kind: "repeat", index: 0 })
  })

  it("matches multi-word answers typed without spaces", () => {
    expect(matchGuess("sprejnakomary", answers, none)).toEqual({ kind: "hit", index: 1 })
  })

  it("treats empty input as a miss", () => {
    expect(matchGuess("  ?! ", answers, none)).toEqual({ kind: "miss" })
  })
})
