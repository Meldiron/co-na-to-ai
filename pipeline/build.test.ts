import { describe, expect, it } from "vitest"
import type { RawResponse } from "./ask"
import { BOARD_SIZE, buildPuzzle, gate, group } from "./build"
import { checkCoverage, type Judgement } from "./cluster"

function responses(raws: Array<string | null>): Array<RawResponse> {
  return raws.map((raw, i) => ({
    answerer: `a${String(i + 1).padStart(3, "0")}`,
    persona: `p${i}`,
    model: raw === null ? null : `vendor/model-${i}`,
    raw,
    attempts: [],
  }))
}

const words = ["pivo", "pivko", "repelent", "kniha", "karty", "svetr", "mikina", "jídlo", "deštník", "kytara", "plavky", "nic"]
const raws = [...words, ...words, null]
const answered = raws.filter((r): r is string => r !== null)

const judgement: Judgement = {
  clusters: [
    { canonical: "Pivo", members: [0, 1, 12, 13], aliases: ["piva", "Pivko", "pivo"] },
    { canonical: "Teplé oblečení", members: [5, 6, 17, 18], aliases: ["svetr", "mikina"] },
    { canonical: "Repelent", members: [2, 14], aliases: ["repelenty"] },
    { canonical: "Kniha", members: [3, 15], aliases: ["knihy"] },
    { canonical: "Karty", members: [4, 16], aliases: ["karta"] },
    { canonical: "Jídlo", members: [7, 19], aliases: ["jidlo"] },
    { canonical: "Deštník", members: [8, 20], aliases: [] },
    { canonical: "Kytara", members: [9, 21], aliases: [] },
    { canonical: "Plavky", members: [10, 22], aliases: [] },
  ],
  invalid: [11, 23],
  offensive: false,
  notes: "",
}

describe("checkCoverage", () => {
  it("accepts a judgement that uses every index once", () => {
    expect(checkCoverage(judgement, answered.length)).toBeNull()
  })

  it("reports missing and doubled indices", () => {
    const broken = { ...judgement, invalid: [11, 11] }
    expect(checkCoverage(broken, answered.length)).toMatch(/missing: 23.*twice: 11/)
  })
})

describe("group and buildPuzzle", () => {
  const rs = responses(raws)
  const grouped = group(rs, judgement)

  it("maps judge indices back to answerers and sorts by votes", () => {
    expect(grouped[0].canonical).toBe("Pivo")
    expect(grouped[0].answerers).toEqual(["a001", "a002", "a013", "a014"])
    expect(grouped.map((g) => g.answerers.length)).toEqual([...grouped.map((g) => g.answerers.length)].sort((a, b) => b - a))
  })

  it("drops aliases that duplicate the canonical form or each other", () => {
    expect(grouped[0].aliases).toEqual(["piva", "pivko"])
  })

  it("builds a puzzle with a ranked board of eight and the rest outside", () => {
    const puzzle = buildPuzzle({
      date: "2026-10-24",
      number: 1,
      questionId: "chata",
      question: "Co si berete s sebou na chatu?",
      responses: rs,
      grouped,
      judgeModel: "judge/model",
      costUsd: 0.123456,
      durationMs: 1000,
    })
    expect(puzzle.answers).toHaveLength(BOARD_SIZE)
    expect(puzzle.answers.map((a) => a.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(puzzle.others.map((o) => o.text)).toEqual(["Plavky"])
    expect(puzzle.asked).toBe(25)
    expect(puzzle.answered).toBe(24)
    expect(puzzle.meta.failed).toBe(1)
    expect(puzzle.meta.costUsd).toBe(0.1235)
    expect(puzzle.responses.find((r) => r.answerer === "a012")?.answer).toBeNull()
    expect(puzzle.responses.find((r) => r.answerer === "a002")?.answer).toBe("Pivo")
  })
})

describe("gate", () => {
  it("rejects a board with too few answers and a dominant top answer", () => {
    const result = gate(group(responses(raws), judgement), 24, judgement)
    expect(result.passed).toBe(false)
    expect(result.flags.join(" ")).toMatch(/only 24 answers/)
  })

  it("passes a split board with enough answers", () => {
    const many = Array.from({ length: 4 }, () => raws.slice(0, 24)).flat()
    const big: Judgement = {
      ...judgement,
      clusters: judgement.clusters.map((c) => ({ ...c, members: [0, 1, 2, 3].flatMap((k) => c.members.map((m) => m + k * 24)) })),
      invalid: [0, 1, 2, 3].flatMap((k) => judgement.invalid.map((m) => m + k * 24)),
    }
    const result = gate(group(responses(many), big), many.length, big)
    expect(result.flags).toEqual([])
    expect(result.passed).toBe(true)
    expect(result.topShare).toBeCloseTo(16 / 96)
  })

  it("flags offensive content", () => {
    const result = gate(group(responses(raws), judgement), 96, { ...judgement, offensive: true })
    expect(result.flags).toContain("judge flagged offensive content")
  })
})
