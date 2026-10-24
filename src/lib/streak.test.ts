import { describe, expect, it } from "vitest"
import { FREEZES, streak } from "./streak"

describe("streak with freezes", () => {
  it("is empty before the first game", () => {
    expect(streak([], "2026-10-24")).toEqual({ current: 0, best: 0, freezesLeft: FREEZES, missed: 0 })
  })

  it("counts consecutive days, today still open", () => {
    expect(streak(["2026-10-21", "2026-10-22", "2026-10-23"], "2026-10-24")).toMatchObject({ current: 3, freezesLeft: 2, missed: 0 })
  })

  it("bridges up to two missed days with freezes, which do not add to the count", () => {
    expect(streak(["2026-10-18", "2026-10-21", "2026-10-24"], "2026-10-24")).toMatchObject({ current: 3, best: 3, freezesLeft: 2 })
    expect(streak(["2026-10-20", "2026-10-21"], "2026-10-24")).toMatchObject({ current: 2, freezesLeft: 0, missed: 2 })
  })

  it("breaks after three missed days in a row", () => {
    expect(streak(["2026-10-19", "2026-10-20"], "2026-10-24")).toMatchObject({ current: 0, best: 2, missed: 3 })
    expect(streak(["2026-10-10", "2026-10-11", "2026-10-15", "2026-10-16"], "2026-10-16")).toMatchObject({ current: 2, best: 2 })
  })

  it("refills both freezes after every played day", () => {
    expect(streak(["2026-10-17", "2026-10-20", "2026-10-23"], "2026-10-24")).toMatchObject({ current: 3, freezesLeft: 2 })
  })
})
