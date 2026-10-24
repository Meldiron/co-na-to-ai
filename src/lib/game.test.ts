import { describe, expect, it } from "vitest"
import { CLEAR_BONUS, applyGuess, hintPattern, initialState, maxHints, pointsFor, pointsWord, progress, replay, revealLetter, scoreLines, shareText, type GameState } from "./game"
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
  it("ends the game on the fifth strike", () => {
    const state = play(["auto", "vlak", "letadlo", "lod", "kolo"])
    expect(state.strikes).toBe(5)
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
    expect(total).toBe(answers.reduce((s, a) => s + a.votes * 10, 0) + CLEAR_BONUS)
  })

  it("refuses multi-word guesses without a strike", () => {
    const { state, outcome } = applyGuess(initialState, answers, "my many words")
    expect(outcome.kind).toBe("multi")
    expect(state).toBe(initialState)
  })

  it("ignores guesses after the game is over", () => {
    const over = play(["a1", "a2", "a3", "a4", "a5"])
    expect(applyGuess(over, answers, "pivo").outcome.kind).toBe("over")
  })
})

describe("scoreLines", () => {
  it("gives each found answer ten points per AI that said it", () => {
    const state = play(["kytara", "pivo", "auto"])
    expect(scoreLines(state, answers)).toEqual({
      lines: [
        { label: "Pivo", rank: 1, hints: 0, points: 200 },
        { label: "Kytara", rank: 8, hints: 0, points: 60 },
      ],
      bonus: 0,
      total: 260,
    })
  })

  it("takes a quarter of an answer's points per revealed letter", () => {
    let state = revealLetter(initialState, answers, 0)
    state = revealLetter(state, answers, 0)
    state = applyGuess(state, answers, "pivo").state
    expect(scoreLines(state, answers).lines[0]).toEqual({ label: "Pivo", rank: 1, hints: 2, points: 100 })
  })
})

describe("letter hints", () => {
  it("is worth more than nothing and less than fewer hints, even for one vote", () => {
    for (const votes of [1, 2, 3, 7, 41]) {
      const values = [0, 1, 2, 3].map((h) => pointsFor(votes, h))
      expect(values.every((v) => v > 0)).toBe(true)
      expect(values).toEqual([...values].sort((a, b) => b - a))
      expect(new Set(values).size).toBe(4)
    }
  })

  it("never reveals the whole word", () => {
    expect(maxHints({ text: "Pivo" })).toBe(3)
    expect(maxHints({ text: "Čaj" })).toBe(2)
    let state = initialState
    for (let i = 0; i < 6; i++) state = revealLetter(state, answers, 0)
    expect(state.hints?.[0]).toBe(3)
    expect(hintPattern("Pivo", 3)).toBe("P i v _")
  })

  it("does not spend hints on found answers or finished games", () => {
    const found = applyGuess(initialState, answers, "pivo").state
    expect(revealLetter(found, answers, 0)).toBe(found)
  })
})

describe("shareText", () => {
  it("shows the board in slot order and the guesses in order, without spoilers", () => {
    const state = play(["pivo", "auto", "kytara"])
    const hinted = applyGuess(revealLetter(state, answers, 2), answers, "kniha").state
    const text = shareText({ label: "24. 10. 2026", question: "Co si berete na chatu?", state: hinted, answers, total: 335, url: "https://example.cz/" })
    expect(text).toBe(["Ptali jsme se 100 AI · 24. 10. 2026", "Co si berete na chatu?", "🟩⬜🟨⬜⬜⬜⬜🟩 3/8", "🟩🟥🟩🟩", "335 bodů", "https://example.cz/"].join("\n"))
    expect(text).not.toMatch(/pivo|kytara/i)
  })
})

describe("challenge share text", () => {
  it("leads with the score to beat and links the same question", () => {
    const state = play(["pivo", "auto"])
    const text = shareText({ label: "24. 10. 2026", question: "Q?", state, answers, total: 200, url: "https://example.cz/hra/2026-10-24", challenge: true })
    expect(text.split("\n")).toEqual(["Dáte víc než 200 bodů?", "Ptali jsme se 100 AI · 24. 10. 2026", "Q?", "🟩⬜⬜⬜⬜⬜⬜⬜ 1/8", "🟩🟥", "https://example.cz/hra/2026-10-24"])
  })
})

describe("pointsWord", () => {
  it("uses Czech plural forms", () => {
    expect([0, 1, 2, 4, 5, 22, 100].map(pointsWord)).toEqual(["bodů", "bod", "body", "body", "bodů", "bodů", "bodů"])
  })
})

describe("replay", () => {
  it("rebuilds found answers and strikes from the guesses alone", () => {
    const claimed: GameState = {
      found: [0, 1, 2, 3, 4, 5, 6, 7],
      guesses: [
        { text: "pivo", result: "hit", index: 0 },
        { text: "lednice", result: "hit", index: 3 },
      ],
      strikes: 0,
      status: "won",
      hints: [0, 9, 0, 0, 0, 0, 0, 0],
      clues: [2, 2, 40],
    }
    const state = replay(answers, claimed)
    expect(state.found).toEqual([0])
    expect(state.strikes).toBe(1)
    expect(state.status).toBe("playing")
    expect(state.hints?.[1]).toBe(maxHints(answers[1]))
    expect(state.clues).toEqual([2])
  })

  it("keeps a surrender", () => {
    expect(replay(answers, { ...initialState, status: "lost" }).status).toBe("lost")
  })

  it("ranks a finished game above any game in progress", () => {
    const playing = applyGuess(initialState, answers, "pivo").state
    expect(progress({ ...initialState, status: "lost" })).toBeGreaterThan(progress(playing))
    expect(progress(playing)).toBeGreaterThan(progress(initialState))
  })
})

describe("share text with rank", () => {
  it("adds the rank before the link when there is one", () => {
    const state: GameState = { ...initialState, found: [0], guesses: [{ text: "pivo", result: "hit", index: 0 }], status: "lost" }
    const base = { label: "24. 10.", question: "Co?", state, answers, total: 120, url: "https://ai100.appwrite.network/hra/2026-10-24", challenge: true }
    const lines = shareText({ ...base, rank: "Lepší než 82 % hráčů" }).split("\n")
    expect(lines.at(-2)).toBe("Lepší než 82 % hráčů")
    expect(lines.at(-1)).toBe(base.url)
    expect(shareText({ ...base, rank: null })).not.toContain("Lepší")
  })
})
