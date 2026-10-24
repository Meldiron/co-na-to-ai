import { describe, expect, it } from "vitest"
import { peopleBoard } from "./people"

const answers = [{ text: "Pivo" }, { text: "Jídlo" }, { text: "Spacák" }]

describe("peopleBoard", () => {
  it("ranks board answers and repeated misses by how many players tried them", () => {
    const board = peopleBoard(
      [
        { found: [0, 1], misses: ["Kytara", "auto"] },
        { found: [0], misses: ["kytara"] },
        { found: [0, 2], misses: ["Kytára", "kytara"] },
        { found: [], misses: ["auto", "pes"] },
      ],
      answers,
    )
    expect(board).toEqual([
      { text: "Pivo", share: 0.75, answer: 0 },
      { text: "kytara", share: 0.75, answer: null },
      { text: "auto", share: 0.5, answer: null },
      { text: "Jídlo", share: 0.25, answer: 1 },
      { text: "Spacák", share: 0.25, answer: 2 },
    ])
  })

  it("keeps a miss only when at least two players typed it", () => {
    expect(peopleBoard([{ found: [], misses: ["tajemství"] }, { found: [0], misses: [] }], answers)).toEqual([{ text: "Pivo", share: 0.5, answer: 0 }])
  })

  it("is empty without games", () => {
    expect(peopleBoard([], answers)).toEqual([])
  })
})
