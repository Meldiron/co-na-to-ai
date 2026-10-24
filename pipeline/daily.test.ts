import { describe, expect, it } from "vitest"
import type { Question } from "../src/lib/types.ts"
import { MAX_ATTEMPTS, pickQuestion, targetDates } from "./daily.ts"

const q = (id: string, status: Question["status"], date?: string): Question => ({ id, text: id, tags: [], status, ...(date ? { date } : {}) })

const scheduled = [q("vlak", "used", "2026-10-24"), q("hodiny", "approved", "2026-10-25"), q("kocovina", "rejected", "2026-10-26")]
const reserves = [q("proud", "used", "2026-10-17"), q("zvuk", "approved"), q("caj", "approved")]

describe("daily question pick", () => {
  it("takes the question scheduled for the date", () => {
    expect(pickQuestion([...scheduled, ...reserves], reserves, [], "2026-10-25")?.id).toBe("hodiny")
  })

  it("falls back to the first unused reserve when the scheduled one was rejected", () => {
    expect(pickQuestion([...scheduled, ...reserves], reserves, [], "2026-10-26")?.id).toBe("zvuk")
  })

  it("skips questions an earlier run already tried", () => {
    const attempts = [
      { date: "2026-10-25", questionId: "hodiny", passed: false },
      { date: "2026-10-20", questionId: "zvuk", passed: true },
    ]
    expect(pickQuestion([...scheduled, ...reserves], reserves, attempts, "2026-10-25")?.id).toBe("caj")
  })

  it("gives up on a date after the attempt limit", () => {
    const attempts = Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({ date: "2026-10-25", questionId: `x${i}`, passed: false }))
    expect(pickQuestion([...scheduled, ...reserves], reserves, attempts, "2026-10-25")).toBeNull()
  })

  it("covers today and the next three days", () => {
    expect(targetDates("2026-10-30")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"])
  })
})
