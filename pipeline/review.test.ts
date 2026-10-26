import { describe, expect, it } from "vitest"
import { checkCoverage, type Judgement } from "./cluster"
import { withoutRejected } from "./review"

const judgement: Judgement = {
  clusters: [
    { canonical: "Bunda", members: [0, 1, 2], aliases: ["bundy"] },
    { canonical: "Péřovka", members: [3, 4], aliases: ["péřová bunda"] },
    { canonical: "Kabát", members: [5], aliases: [] },
    { canonical: "Parka", members: [6], aliases: [] },
  ],
  invalid: [7],
  offensive: false,
  notes: "",
}

describe("withoutRejected", () => {
  const reviewed = withoutRejected(
    judgement,
    new Map([
      [0, "repeats the question"],
      [2, "repeats the question"],
    ]),
  )

  it("drops rejected answers and counts their members as invalid", () => {
    expect(reviewed.clusters.map((c) => c.canonical)).toEqual(["Péřovka", "Parka"])
    expect(reviewed.invalid).toEqual([7, 0, 1, 2, 5])
    expect(checkCoverage(reviewed, 8)).toBeNull()
  })

  it("records what was rejected and why", () => {
    expect(reviewed.rejected).toEqual([
      { canonical: "Bunda", votes: 3, reason: "repeats the question" },
      { canonical: "Kabát", votes: 1, reason: "repeats the question" },
    ])
  })

  it("keeps the judgement as it was when nothing is rejected", () => {
    const kept = withoutRejected(judgement, new Map())
    expect(kept.clusters).toEqual(judgement.clusters)
    expect(kept.invalid).toEqual([7])
    expect(kept.rejected).toEqual([])
  })
})
