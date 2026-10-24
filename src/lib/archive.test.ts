import { describe, expect, it } from "vitest"
import { MOCK_TODAY, buildArchive, dayTone, mockArchive, monthsOf, unplayed, weekTone } from "./archive"

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
    expect(unplayed(archive)).toEqual({ days: 2, weeks: 1 })
    expect(monthsOf(archive)).toEqual(["2026-10", "2026-09"])
  })
})

describe("mockArchive", () => {
  it("covers a whole year of days and Mondays, newest first", () => {
    const mock = mockArchive(["A?", "B?"])
    expect(mock.today).toBe(MOCK_TODAY)
    expect(mock.days[0].date).toBe(MOCK_TODAY)
    expect(mock.days.at(-1)?.date).toBe("2026-10-01")
    expect(mock.days).toHaveLength(389)
    expect(mock.weeks[0].week).toBe("2027-10-18")
    expect(mock.weeks.at(-1)?.week).toBe("2026-10-05")
    expect(mock.days[0].result).toBeNull()
    expect(mockArchive(["A?", "B?"])).toEqual(mock)
  })
})
