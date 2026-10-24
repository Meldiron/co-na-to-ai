import { describe, expect, it } from "vitest"
import { isDuplicate } from "./bank.ts"
import { dominated, probeAnswerers, scattered, tally, verdict } from "./probe.ts"

describe("question duplicates", () => {
  it("catches the same question with other punctuation or diacritics", () => {
    expect(isDuplicate("Co si berete s sebou na chatu", ["Co si berete s sebou na chatu?"])).toBe(true)
    expect(isDuplicate("CO SI BERETE S SEBOU NA CHATU?", ["Co si berete s sebou na chatu?"])).toBe(true)
  })

  it("catches a close rewording", () => {
    expect(isDuplicate("Co si berete na chatu s sebou?", ["Co si berete s sebou na chatu?"])).toBe(true)
  })

  it("lets a different question through", () => {
    expect(isDuplicate("Co si berete s sebou k moři?", ["Co si berete s sebou na chatu?"])).toBe(false)
  })
})

describe("probe tally", () => {
  it("groups spellings and finds the dominant answer", () => {
    const result = tally(["Kmín", "kmin", "Kmín", "Majoránka", "majoranka", "Pepř", null, "Kmín."])
    expect(result.answered).toBe(7)
    expect(result.top).toBe("Kmín")
    expect(result.share).toBeCloseTo(4 / 7)
    expect(result.distinct).toBe(3)
  })

  it("flags a question only with enough answers and a clear leader", () => {
    expect(dominated({ answered: 15, share: 0.6 })).toBe(true)
    expect(dominated({ answered: 15, share: 0.4 })).toBe(false)
    expect(dominated({ answered: 6, share: 0.9 })).toBe(false)
  })

  it("flags answers that are all over the place", () => {
    expect(scattered({ answered: 15, distinct: 14 })).toBe(true)
    expect(scattered({ answered: 15, distinct: 11 })).toBe(false)
    expect(verdict(tally(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]))).toBe("12 různých odpovědí z 12")
    expect(verdict(tally(["kmín", "kmín", "kmín", "kmín", "kmín", "kmín", "pepř", "sůl", "majoránka", "paprika"]))).toBe("kmín má 60 %")
  })

  it("spreads the probe across the cast", () => {
    const cast = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}`, model: `m${i}`, persona: `p${i}` }))
    const picked = probeAnswerers(cast)
    expect(picked).toHaveLength(15)
    expect(new Set(picked.map((a) => a.id)).size).toBe(15)
    expect(picked[14].id).toBe("a93")
  })
})
