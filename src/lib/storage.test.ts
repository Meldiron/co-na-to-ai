import { describe, expect, it } from "vitest"
import { decodeSecret, encodeSecret } from "./secret"
import { computeStats, type Result } from "./storage"

const r = (score: number, daily = true): Result => ({ score, found: 5, strikes: 3, cleared: false, daily })

describe("computeStats", () => {
  it("counts a streak ending today", () => {
    const stats = computeStats({ "2026-10-24": r(40), "2026-10-25": r(60), "2026-10-26": r(50) }, "2026-10-26")
    expect(stats).toMatchObject({ played: 3, streak: 3, bestStreak: 3, average: 50 })
  })

  it("keeps the streak alive until today's game is played", () => {
    expect(computeStats({ "2026-10-24": r(40), "2026-10-25": r(60) }, "2026-10-26").streak).toBe(2)
  })

  it("bridges a missed day with a freeze", () => {
    const stats = computeStats({ "2026-10-24": r(40), "2026-10-25": r(60), "2026-10-27": r(50) }, "2026-10-28")
    expect(stats.streak).toBe(3)
    expect(stats.freezesLeft).toBe(2)
  })

  it("breaks the streak after three missed days", () => {
    const stats = computeStats({ "2026-10-20": r(40), "2026-10-21": r(60), "2026-10-25": r(50) }, "2026-10-25")
    expect(stats.streak).toBe(1)
    expect(stats.bestStreak).toBe(2)
  })

  it("does not count archive games in the streak", () => {
    const stats = computeStats({ "2026-10-24": r(40, false), "2026-10-25": r(60) }, "2026-10-25")
    expect(stats.streak).toBe(1)
    expect(stats.played).toBe(2)
  })
})

describe("secret", () => {
  it("round-trips Czech text and is not readable as plain JSON", () => {
    const secret = { answers: [{ rank: 1, text: "Řízek se salátem", votes: 12, aliases: ["řízek"], answerers: ["a001"] }], others: [], responses: [] }
    const encoded = encodeSecret(secret, "2026-10-24")
    expect(encoded).not.toContain("Řízek")
    expect(atob(encoded)).not.toContain("rizek")
    expect(decodeSecret(encoded, "2026-10-24")).toEqual(secret)
  })
})
