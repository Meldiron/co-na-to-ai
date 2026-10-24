import { describe, expect, it } from "vitest"
import { CLEAR_BONUS, applyGuess, initialState, pointsWord, scoreLines, shareText, type GameState } from "./game"
import type { BoardAnswer } from "./types"

const answers: Array<BoardAnswer> = ["Pivo", "Repelent", "Kniha", "Karty", "Svetr", "Jídlo", "Deštník", "Kytara"].map((text, i) => ({
  rank: i + 1,
  text,
  votes: 20 - i * 2,
  aliases: [],
  answerers: [],
}))

function play(guesses: Array<string>): GameState {
  return guesses.reduce((state, g) => applyGuess(state, answers, g).state, initialState)
}

describe("applyGuess", () => {
  it("ends the game on the third strike", () => {
    const state = play(["auto", "vlak", "letadlo"])
    expect(state.strikes).toBe(3)
    expect(state.status).toBe("lost")
  })

  it("does not count a repeated wrong guess twice", () => {
    const first = applyGuess(initialState, answers, "auto").state
    const { state, outcome } = applyGuess(first, answers, "Auto")
    expect(outcome.kind).toBe("repeat-miss")
    expect(state.strikes).toBe(1)
  })

  it("wins when every answer is found and adds the bonus", () => {
    const state = play(answers.map((a) => a.text))
    expect(state.status).toBe("won")
    const { total, bonus } = scoreLines(state, answers)
    expect(bonus).toBe(CLEAR_BONUS)
    expect(total).toBe(answers.reduce((s, a) => s + a.votes, 0) + CLEAR_BONUS)
  })

  it("ignores guesses after the game is over", () => {
    const over = play(["a1", "a2", "a3"])
    expect(applyGuess(over, answers, "pivo").outcome.kind).toBe("over")
  })
})

describe("scoreLines", () => {
  it("gives each found answer its vote count as points", () => {
    const state = play(["kytara", "pivo", "auto"])
    expect(scoreLines(state, answers)).toEqual({
      lines: [
        { label: "Pivo", rank: 1, points: 20 },
        { label: "Kytara", rank: 8, points: 6 },
      ],
      bonus: 0,
      total: 26,
    })
  })
})

describe("shareText", () => {
  it("shows the board in slot order and the guesses in order, without spoilers", () => {
    const state = play(["pivo", "auto", "kytara"])
    const text = shareText({ number: 7, state, answers, total: 26, url: "https://example.cz/" })
    expect(text).toBe(["Ptali jsme se 100 AI · č. 7", "🟩⬜⬜⬜⬜⬜⬜🟩 2/8", "🟩🟥🟩", "26 bodů", "https://example.cz/"].join("\n"))
    expect(text).not.toMatch(/pivo|kytara/i)
  })
})

describe("pointsWord", () => {
  it("uses Czech plural forms", () => {
    expect([0, 1, 2, 4, 5, 22, 100].map(pointsWord)).toEqual(["bodů", "bod", "body", "body", "bodů", "bodů", "bodů"])
  })
})
