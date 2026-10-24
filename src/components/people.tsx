import { PEOPLE_MIN_PLAYERS } from "@/lib/people"
import type { BoardAnswer } from "@/lib/types"
import type { DayStats } from "@/server/games"
import { Flap } from "./flap"

type Row = { text: string; value: string; match: boolean }

const plural = new Intl.PluralRules("cs-CZ")
const playersWord = (n: number) => (plural.select(n) === "one" ? "hráč" : plural.select(n) === "few" ? "hráči" : "hráčů")

function Column({ title, label, rows }: { title: string; label: string; rows: Array<Row> }) {
  return (
    <div>
      <h3 className="flex items-baseline justify-between gap-4 text-[1.25rem] font-bold">
        {title}
        <span className="text-sm font-normal text-flap-dim">{label}</span>
      </h3>
      <ol className="mt-3 grid gap-[5px]">
        {rows.map((row, i) => (
          <li key={i} className="grid h-[44px] grid-cols-[2.75rem_1fr_4.5rem] gap-[3px] sm:h-[52px] md:h-[60px] md:grid-cols-[3.5rem_1fr_5.5rem]">
            <Flap text={String(i + 1)} tone={row.match ? "key" : undefined} align="center" delay={i * 70} className="h-full" />
            <Flap text={row.text} tone={row.match ? undefined : "dim"} delay={i * 70 + 60} className="h-full" />
            <Flap text={row.value} tone={row.match ? undefined : "dim"} align="end" delay={i * 70 + 120} className="h-full" />
            <span className="sr-only">{row.match ? "Shoda" : "Bez shody"}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function People({ answers, stats }: { answers: Array<BoardAnswer>; stats: DayStats | null }) {
  if (!stats || stats.players < PEOPLE_MIN_PLAYERS || stats.people.length < 3) return null
  const { people, players } = stats
  const matched = new Set(people.flatMap((p) => (p.answer === null ? [] : [p.answer])))

  return (
    <section id="co-na-to-lide" className="scroll-mt-4 bg-board text-flap-ink">
      <div className="page py-24 md:py-36">
        <div className="grid gap-4 md:grid-cols-12 md:gap-6">
          <h2 className="head reveal md:col-span-6">Co na to lidé</h2>
          <p className="reveal md:col-span-6 md:self-end md:text-right">
            Shoda s AI: <span className="font-semibold">{matched.size} z {people.length}</span>
          </p>
        </div>
        <div className="mt-10 grid gap-12 md:mt-14 md:grid-cols-2 md:gap-6">
          <Column title="Lidé" label={`${players} ${playersWord(players)}`} rows={people.map((p) => ({ text: p.text, value: `${Math.round(p.share * 100)} %`, match: p.answer !== null }))} />
          <Column title="AI" label="100 AI" rows={answers.map((a, i) => ({ text: a.text, value: String(a.votes), match: matched.has(i) }))} />
        </div>
      </div>
    </section>
  )
}
