import { describe, expect, it } from "vitest"
import { gateReasons } from "./gate-text"

const base = { passed: false, answered: 99, topShare: 0.3, boardShare: 0.9, clustersWithTwo: 9, flags: [] }

describe("gateReasons", () => {
  it("explains each failed check in Czech from the structured values", () => {
    expect(gateReasons({ ...base, clustersWithTwo: 6 })).toEqual(["jen 6 odpovědí má aspoň 2 hlasy (potřeba 8)"])
    expect(gateReasons({ ...base, clustersWithTwo: 3 })).toEqual(["jen 3 odpovědi mají aspoň 2 hlasy (potřeba 8)"])
    expect(gateReasons({ ...base, topShare: 0.78 }, "Rajčata")).toEqual(["Rajčata má 78 % hlasů (nejvýš 45 %)"])
    expect(gateReasons({ ...base, answered: 60, boardShare: 0.38, offensive: true })).toEqual([
      "odpovědělo jen 60 AI (potřeba 80)",
      "tabule pokrývá jen 38 % odpovědí (potřeba 50 %)",
      "rozhodčí model označil nevhodný obsah",
    ])
  })

  it("returns nothing for a passing board", () => {
    expect(gateReasons({ ...base, passed: true })).toEqual([])
  })
})
