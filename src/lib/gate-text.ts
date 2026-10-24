import { GATE, type GateResult } from "../../pipeline/build.ts"

const plural = new Intl.PluralRules("cs-CZ")
const percent = (share: number) => `${Math.round(share * 100)} %`

function withTwoVotes(n: number): string {
  if (n === 0) return "žádná odpověď nemá"
  const category = plural.select(n)
  return category === "one" ? `jen ${n} odpověď má` : category === "few" ? `jen ${n} odpovědi mají` : `jen ${n} odpovědí má`
}

export function gateReasons(gate: GateResult, topAnswer?: string): Array<string> {
  const reasons: Array<string> = []
  if (gate.answered < GATE.minAnswered) reasons.push(`odpovědělo jen ${gate.answered} AI (potřeba ${GATE.minAnswered})`)
  if (gate.topShare > GATE.maxTopShare) reasons.push(`${topAnswer ?? "nejčastější odpověď"} má ${percent(gate.topShare)} hlasů (nejvýš ${percent(GATE.maxTopShare)})`)
  if (gate.clustersWithTwo < GATE.minClustersWithTwo) reasons.push(`${withTwoVotes(gate.clustersWithTwo)} aspoň 2 hlasy (potřeba ${GATE.minClustersWithTwo})`)
  if (gate.boardShare < GATE.minBoardShare) reasons.push(`tabule pokrývá jen ${percent(gate.boardShare)} odpovědí (potřeba ${percent(GATE.minBoardShare)})`)
  if (gate.offensive) reasons.push("rozhodčí model označil nevhodný obsah")
  return reasons
}
