import { useEffect, useState } from "react"
import { gameRef } from "@/hooks/use-game"
import { pointsWord } from "@/lib/game"
import type { BoardAnswer, PuzzlePayload } from "@/lib/types"
import { getDayStats } from "@/server/account-api"
import type { DayStats } from "@/server/games"
import { openAccount, useAccount } from "./account"

const plural = new Intl.PluralRules("cs-CZ")
const percent = (share: number) => `${Math.round(share * 100)} %`

function players(n: number): string {
  const category = plural.select(n)
  return category === "one" ? `${n} hráč` : category === "few" ? `${n} hráči` : `${n} hráčů`
}

function finishedBy(n: number): string {
  const category = plural.select(n)
  if (category === "one") return `Tuhle tabuli zatím dohrál ${n} hráč`
  if (category === "few") return `Tuhle tabuli zatím dohráli ${n} hráči`
  return `Tuhle tabuli zatím dohrálo ${n} hráčů`
}

export function Others({ payload, answers, synced }: { payload: PuzzlePayload; answers: Array<BoardAnswer>; synced: number }) {
  const { enabled, user } = useAccount()
  const [stats, setStats] = useState<DayStats | null>(null)
  const { kind, id } = gameRef(payload)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getDayStats({ data: { kind, id } })
      .then((next) => !cancelled && setStats(next))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [enabled, kind, id, synced])

  if (!enabled || !stats || stats.players === 0) return null
  const { players: count, me } = stats
  const leaderIncludesMe = stats.leaders.some((l) => l.me)

  return (
    <section id="ostatni" className="scroll-mt-4 bg-field text-field-ink">
      <div className="page grid gap-12 py-24 md:grid-cols-12 md:gap-6 md:py-36">
        <div className="md:col-span-6">
          <h2 className="head reveal">Jak hráli ostatní</h2>
          <p className="reveal mt-4 max-w-[46ch]">
            {count === 1
              ? "Zatím jste ji dohráli jen vy. Pošlete ji dál a uvidíte, jak na tom jsou ostatní."
              : `${finishedBy(count)}. Průměr je ${stats.average} ${pointsWord(stats.average)}, celou tabuli našlo ${percent(stats.cleared)}.`}
          </p>

          {me && count > 1 && (
            <div className="reveal mt-12">
              <p className="giant">{percent(me.betterThan)}</p>
              <p className="mt-4">
                hráčů jste porazili. Jste {me.rank}. z {count}
                {me.tied > 0 ? `, stejně bodů má ještě ${players(me.tied)}.` : "."}
              </p>
            </div>
          )}

          <h3 className="reveal mt-14 text-[1.25rem] font-bold">Co našli ostatní</h3>
          <ol className="mt-4 grid gap-1.5" aria-label="Kolik hráčů našlo kterou odpověď">
            {answers.map((answer, i) => (
              <li key={answer.rank} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
                <span className="truncate font-semibold">
                  {answer.rank}. {answer.text}
                </span>
                <span className="h-6 bg-board">
                  <span className="block h-full bg-paper" style={{ width: `${Math.round(stats.foundShare[i] * 100)}%` }} />
                </span>
                <span className="min-w-[3.25rem] text-right whitespace-nowrap tabular-nums">{percent(stats.foundShare[i])}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="zigzag-bottom bg-paper px-6 pt-7 pb-14 text-ink md:px-8">
            <p className="font-semibold">Žebříček</p>
            <ol className="mt-5 grid gap-2.5">
              {stats.leaders.map((leader, i) =>
                leader.me ? (
                  <li key={i} className="inverted-row -mx-6 px-6 md:-mx-8 md:px-8">
                    <span className="truncate">
                      {leader.rank}. {leader.name} (vy)
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{leader.score}</span>
                  </li>
                ) : (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="truncate">
                      {leader.rank}. {leader.name}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{leader.score}</span>
                  </li>
                ),
              )}
              {me && !leaderIncludesMe && (
                <li className="inverted-row -mx-6 mt-2 px-6 md:-mx-8 md:px-8">
                  <span className="truncate">
                    {me.rank}. {user?.name ?? "Vy"} (vy)
                  </span>
                  <span className="leader" aria-hidden />
                  <span className="tabular-nums">{me.score}</span>
                </li>
              )}
            </ol>
          </div>

          {user && (user.guest || !user.named) && (
            <div className="mt-6 bg-field-step p-5">
              <p>
                {user.guest
                  ? `V žebříčku jste ${user.name}. Založte si účet, ať o výsledky a sérii nepřijdete ani v jiném zařízení.`
                  : `V žebříčku jste ${user.name}. Nastavte si vlastní jméno.`}
              </p>
              <button
                type="button"
                onClick={openAccount}
                className="mt-4 inline-flex h-11 items-center bg-paper px-5 font-semibold text-ink transition-colors hover:bg-red hover:text-red-ink"
              >
                {user.guest ? "Založit účet a jméno" : "Nastavit jméno"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
