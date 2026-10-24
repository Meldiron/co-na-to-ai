import { describe, expect, it } from "vitest"
import { buildArchive, dayTone, monthsOf, weekTone } from "./archive"

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
  it("attaches results and tones to days and weeks", () => {
    expect(archive.week).toBe("2026-10-19")
    expect(archive.days.map((d) => dayTone(d, archive.today))).toEqual(["today", "cleared", "open"])
    expect(archive.weeks.map((w) => weekTone(w, archive.week))).toEqual(["today", "cleared"])
    expect(monthsOf(archive)).toEqual(["2026-10", "2026-09"])
  })
})
