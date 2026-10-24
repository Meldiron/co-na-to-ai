import { Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { formatDayMonth, msUntilNextPragueMidnight } from "@/lib/day"
import { pointsWord } from "@/lib/game"
import type { PuzzleSummary } from "@/lib/types"
import { RESULTS_EVENT, computeStats, loadResults, type Result, type Stats } from "@/lib/storage"
import { Flap } from "./flap"

const GHOST = [6, 14, 30, 52, 70, 58, 34, 16, 8]

function useCountdown(): [string, string, string] {
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setMs(msUntilNextPragueMidnight())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  if (ms === null) return ["", "", ""]
  const total = Math.floor(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return [pad(Math.floor(total / 3600)), pad(Math.floor((total % 3600) / 60)), pad(total % 60)]
}

function useStats(today: string): { stats: Stats; todayResult: Result | null; results: Record<string, Result> } | null {
  const [value, setValue] = useState<{ stats: Stats; todayResult: Result | null; results: Record<string, Result> } | null>(null)

  useEffect(() => {
    const read = () => {
      const results = loadResults()
      setValue({ stats: computeStats(results, today), todayResult: today in results ? results[today] : null, results })
    }
    read()
    window.addEventListener(RESULTS_EVENT, read)
    window.addEventListener("storage", read)
    return () => {
      window.removeEventListener(RESULTS_EVENT, read)
      window.removeEventListener("storage", read)
    }
  }, [today])

  return value
}

export function Departure({ today, recent }: { today: string; recent: Array<PuzzleSummary> }) {
  const [hours, minutes, seconds] = useCountdown()
  const data = useStats(today)
  const stats = data?.stats
  const peak = Math.max(1, ...(stats?.distribution ?? [0]))

  const rows: Array<[string, string]> = stats
    ? [
        ["Odehráno", String(stats.played)],
        ["Celá tabule", stats.played ? `${Math.round((stats.cleared / stats.played) * 100)} %` : "0 %"],
        ["Průměr bodů", String(stats.average)],
        ["Nejlepší výsledek", String(stats.best)],
      ]
    : []

  return (
    <section id="dalsi-otazka" className="bg-board text-flap-ink">
      <div className="page grid gap-12 py-24 md:grid-cols-12 md:gap-6 md:py-40">
        <div className="md:col-span-6">
          <h2 className="head reveal">Další otázka za</h2>
          <div className="reveal mt-6 flex items-center gap-2 md:gap-3" role="timer" aria-label={hours ? `${hours} hodin ${minutes} minut ${seconds} sekund` : "Počítám čas do půlnoci"}>
            <Flap text={hours} align="center" className="h-20 w-[4.6rem] text-[length:var(--step-display)] md:h-28 md:w-28" />
            <span className="head" aria-hidden>
              :
            </span>
            <Flap text={minutes} align="center" className="h-20 w-[4.6rem] text-[length:var(--step-display)] md:h-28 md:w-28" />
            <span className="head" aria-hidden>
              :
            </span>
            <Flap text={seconds} align="center" className="h-20 w-[4.6rem] text-[length:var(--step-display)] md:h-28 md:w-28" />
          </div>
          <p className="reveal mt-6 max-w-[44ch]">Nová tabule vyjíždí každý den o půlnoci českého času, pro všechny stejná.</p>

          {recent.length > 0 && (
            <>
              <h3 className="reveal mt-14 text-[1.25rem] font-bold">Mezitím si zahrajte</h3>
              <ul className="mt-4 grid gap-2">
                {recent.map((game) => {
                  const result = data && game.date in data.results ? data.results[game.date] : null
                  return (
                    <li key={game.date}>
                      <Link
                        to="/hra/$datum"
                        params={{ datum: game.date }}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-4 bg-flap py-3 pr-4 pl-3 transition-colors hover:bg-paper hover:text-ink"
                      >
                        <span className="tile">{formatDayMonth(game.date)}</span>
                        <span className="font-semibold">{game.question}</span>
                        <span className="text-sm whitespace-nowrap text-flap-dim">{result ? `${result.score} ${pointsWord(result.score)}` : "nehráno"}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <Link to="/archiv" className="reveal mt-6 inline-flex h-12 items-center bg-flap px-5 font-semibold transition-colors hover:bg-paper hover:text-ink">
            Celý archiv tabulí
          </Link>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="zigzag-bottom bg-paper px-6 pt-6 pb-14 text-ink md:px-8">
            <p className="font-semibold">Vaše statistiky</p>
            {stats ? (
              <>
                <ul className="mt-5 grid gap-2">
                  {rows.map(([label, value]) => (
                    <li key={label} className="flex items-baseline gap-2">
                      <span>{label}</span>
                      <span className="leader" aria-hidden />
                      <span className="tabular-nums">{value}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-7 font-semibold">Série dnů</p>
                <ul className="mt-2 grid gap-2">
                  <li className="flex items-baseline gap-2">
                    <span>Aktuální</span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{stats.streak}</span>
                  </li>
                  <li className="flex items-baseline gap-2">
                    <span>Nejdelší</span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{stats.bestStreak}</span>
                  </li>
                </ul>

                <p className="mt-7 font-semibold">Kolik odpovědí jste našli</p>
                {stats.played === 0 ? (
                  <>
                    <p className="mt-2 text-ink-soft">Po první hře tu uvidíte, kolik odpovědí z osmi obvykle najdete.</p>
                    <ol className="mt-3 grid gap-1.5" aria-hidden>
                      {GHOST.map((width, i) => (
                        <li key={i} className="grid grid-cols-[1.25rem_1fr] items-center gap-2 text-ink-soft/60">
                          <span className="tabular-nums">{8 - i}</span>
                          <span className="h-6 bg-paper-step/70" style={{ width: `${width}%` }} />
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <ol className="mt-3 grid gap-1.5" aria-label="Rozložení nalezených odpovědí">
                    {stats.distribution
                      .map((count, found) => ({ count, found }))
                      .reverse()
                      .map(({ count, found }) => {
                        const isToday = data.todayResult?.found === found
                        return (
                          <li key={found} className="grid grid-cols-[1.25rem_1fr] items-center gap-2">
                            <span className="tabular-nums">{found}</span>
                            <span className="flex items-center">
                              <span
                                className={`flex h-6 min-w-7 items-center justify-end px-2 text-sm font-semibold tabular-nums ${isToday ? "bg-red text-red-ink" : count ? "bg-field text-field-ink" : "bg-paper-step text-ink-soft"}`}
                                style={{ width: `${(count / peak) * 100}%` }}
                              >
                                {count}
                              </span>
                            </span>
                          </li>
                        )
                      })}
                  </ol>
                )}

                <p className="inverted-row -mx-6 mt-7 px-6 md:-mx-8 md:px-8">
                  <span>Dnešní hra</span>
                  <span className="leader" aria-hidden />
                  <span className="tabular-nums">{data.todayResult ? `${data.todayResult.score} ${pointsWord(data.todayResult.score)}` : "zatím nehráno"}</span>
                </p>
              </>
            ) : (
              <p className="mt-5 text-ink-soft">Načítám statistiky z tohoto prohlížeče…</p>
            )}
          </div>
          <p className="mt-6 text-sm text-flap-dim">Statistiky se ukládají jen v tomto prohlížeči. Do série se počítá hra dohraná v den, kdy otázka vyšla.</p>
        </div>
      </div>
    </section>
  )
}
