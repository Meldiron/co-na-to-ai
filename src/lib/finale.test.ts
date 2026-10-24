import { describe, expect, it } from "vitest"
import { finaleNumber, finaleShareText, isFinaleWeek, scoreAnswer, weekLabel, weekOf, type FinaleQuestion } from "./finale"

const question: FinaleQuestion = {
  slot: 0,
  question: "Co si dáte k pivu?",
  answered: 98,
  answers: [
    { rank: 1, text: "Utopenec", votes: 38, aliases: ["utopenci"] },
    { rank: 2, text: "Tvarůžky", votes: 21, aliases: [] },
  ],
}

describe("weekOf", () => {
  it("returns the Monday of the week", () => {
    expect(weekOf("2026-10-24")).toBe("2026-10-19")
    expect(weekOf("2026-10-25")).toBe("2026-10-19")
    expect(weekOf("2026-10-26")).toBe("2026-10-26")
    expect(weekOf("2027-01-01")).toBe("2026-12-28")
  })
})

describe("isFinaleWeek", () => {
  it("accepts Mondays from launch up to the current week", () => {
    expect(isFinaleWeek("2026-10-19", "2026-10-26")).toBe(true)
    expect(isFinaleWeek("2026-10-26", "2026-10-26")).toBe(true)
    expect(isFinaleWeek("2026-11-02", "2026-10-26")).toBe(false)
    expect(isFinaleWeek("2026-10-12", "2026-10-26")).toBe(false)
    expect(isFinaleWeek("2026-10-20", "2026-10-26")).toBe(false)
    expect(isFinaleWeek("nesmysl", "2026-10-26")).toBe(false)
  })
})

describe("finaleNumber and weekLabel", () => {
  it("counts weeks from launch", () => {
    expect(finaleNumber("2026-10-19")).toBe(1)
    expect(finaleNumber("2026-11-02")).toBe(3)
    expect(weekLabel("2026-10-26")).toBe("26. 10. – 1. 11.")
  })
})

describe("scoreAnswer", () => {
  it("scores a match with the votes of that answer", () => {
    expect(scoreAnswer(question, " utopence ", false)).toEqual({ text: "utopence", index: 0, points: 38, late: false })
    expect(scoreAnswer(question, "tvaruzky", false)).toEqual({ text: "tvaruzky", index: 1, points: 21, late: false })
  })

  it("gives nothing for a miss, an empty answer or a late one", () => {
    expect(scoreAnswer(question, "chleba", false).points).toBe(0)
    expect(scoreAnswer(question, "", false)).toEqual({ text: "", index: null, points: 0, late: false })
    expect(scoreAnswer(question, "utopenec", true)).toEqual({ text: "utopenec", index: null, points: 0, late: true })
  })
})

describe("finaleShareText", () => {
  it("shows top answers, other hits and misses", () => {
    const answers = [
      { text: "a", index: 0, points: 40, late: false },
      { text: "b", index: 2, points: 20, late: false },
      { text: "c", index: null, points: 0, late: false },
      { text: "d", index: 0, points: 30, late: false },
      { text: "e", index: 0, points: 25, late: false },
    ]
    expect(finaleShareText("2026-10-19", answers, "https://example.cz/finale")).toBe(
      ["Co na to AI · Finále č. 1", "🟩🟨⬜🟩🟩 115 bodů, vyhráno", "https://example.cz/finale"].join("\n"),
    )
  })
})
