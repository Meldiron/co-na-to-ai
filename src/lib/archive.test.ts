import { describe, expect, it } from "vitest"
import { buildArchive, dayMark, monthsOf, weekMark } from "./archive"

const archive = buildArchive({
  today: "2026-10-24",
  puzzles: [
    { date: "2026-10-24", number: 24, question: "Dnes?" },
    { date: "2026-10-23", number: 23, question: "Včera?" },
    { date: "2026-09-30", number: 0, question: "Září?" },
  ],
  finales: ["2026-10-19", "2026-10-12"],
  results: { "2026-10-23": { score: 900, found: 8, strikes: 1, cleared: true, daily: true } },
  finaleResults: { "2026-10-12": { status: "finished", score: 120 } },
})

describe("buildArchive", () => {
  it("marks what was played, what was perfect and what is live", () => {
    expect(archive.week).toBe("2026-10-19")
    expect(archive.days.map((d) => dayMark(d, archive.today))).toEqual([
      { played: false, perfect: false, live: true },
      { played: true, perfect: true, live: false },
      { played: false, perfect: false, live: false },
    ])
    expect(archive.weeks.map((w) => weekMark(w, archive.week))).toEqual([
      { played: false, perfect: false, live: true },
      { played: true, perfect: true, live: false },
    ])
    expect(monthsOf(archive)).toEqual(["2026-10", "2026-09"])
  })
})
