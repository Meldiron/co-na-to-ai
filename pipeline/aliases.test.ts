import { describe, expect, it } from "vitest"
import { resolveAliases } from "./aliases"

describe("resolveAliases", () => {
  it("gives a word shared by two answers to the higher-ranked one", () => {
    const out = resolveAliases(
      ["Pivo", "Víno"],
      [
        { canonical: "Pivo", accept: ["pivko", "alkohol", "chlast"] },
        { canonical: "Víno", accept: ["vínko", "alkohol"] },
      ],
      [],
    )
    expect(out.get("Pivo")).toEqual(["pivko", "alkohol", "chlast"])
    expect(out.get("Víno")).toEqual(["vínko"])
  })

  it("never accepts a word that names an outside answer or another board answer", () => {
    const out = resolveAliases(
      ["Pivo", "Kofola"],
      [
        { canonical: "Pivo", accept: ["kofola", "Slivovice", "lahváč"] },
        { canonical: "Kofola", accept: ["limonáda"] },
      ],
      ["Slivovice"],
    )
    expect(out.get("Pivo")).toEqual(["lahváč"])
  })

  it("drops spelling duplicates that the matcher already treats as equal", () => {
    const out = resolveAliases(["Spacák"], [{ canonical: "Spacák", accept: ["spacak", "spací pytel", "spaci pitel"] }], [])
    expect(out.get("Spacák")).toEqual(["spací pytel"])
  })
})
