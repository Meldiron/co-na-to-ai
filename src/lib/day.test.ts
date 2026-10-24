import { describe, expect, it } from "vitest"
import { LAUNCH_DATE, addDays, isValidDate, msUntilNextPragueMidnight, pragueDate, puzzleNumber } from "./day"

describe("pragueDate", () => {
  it("switches at midnight Prague time in winter (UTC+1)", () => {
    expect(pragueDate(new Date("2026-12-24T22:59:59Z"))).toBe("2026-12-24")
    expect(pragueDate(new Date("2026-12-24T23:00:00Z"))).toBe("2026-12-25")
  })

  it("switches at midnight Prague time in summer (UTC+2)", () => {
    expect(pragueDate(new Date("2027-07-05T21:59:59Z"))).toBe("2027-07-05")
    expect(pragueDate(new Date("2027-07-05T22:00:00Z"))).toBe("2027-07-06")
  })

  it("handles the night the clocks go back", () => {
    expect(pragueDate(new Date("2026-10-24T21:59:59Z"))).toBe("2026-10-24")
    expect(pragueDate(new Date("2026-10-24T22:00:00Z"))).toBe("2026-10-25")
    expect(pragueDate(new Date("2026-10-25T22:59:59Z"))).toBe("2026-10-25")
    expect(pragueDate(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26")
  })
})

describe("msUntilNextPragueMidnight", () => {
  it("counts down to the next Prague midnight", () => {
    const now = new Date("2026-12-24T22:00:00Z")
    expect(Math.abs(msUntilNextPragueMidnight(now) - 3_600_000)).toBeLessThanOrEqual(1000)
  })

  it("is correct on a 25-hour day", () => {
    const now = new Date("2026-10-24T22:00:00Z")
    expect(Math.abs(msUntilNextPragueMidnight(now) - 25 * 3_600_000)).toBeLessThanOrEqual(1000)
  })
})

describe("puzzle numbering", () => {
  it("starts at 1 on launch day and counts days", () => {
    expect(puzzleNumber(LAUNCH_DATE)).toBe(1)
    expect(puzzleNumber("2026-10-24")).toBe(8)
    expect(puzzleNumber("2027-10-24")).toBe(373)
  })

  it("adds days across month and DST boundaries", () => {
    expect(addDays("2026-10-24", 8)).toBe("2026-11-01")
    expect(addDays("2027-03-27", 2)).toBe("2027-03-29")
  })

  it("validates calendar dates", () => {
    expect(isValidDate("2027-02-28")).toBe(true)
    expect(isValidDate("2027-02-29")).toBe(false)
    expect(isValidDate("27-02-28")).toBe(false)
  })
})
