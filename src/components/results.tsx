import { useEffect, useRef, useState } from "react"
import { domToBlob } from "modern-screenshot"
import { Button } from "@/components/ui/button"
import { formatDayMonth } from "@/lib/day"
import { MAX_STRIKES, hintsUsed, maxScore, pointsFor, pointsWord, scoreLines, shareText, type GameState } from "@/lib/game"
import type { BoardAnswer, PuzzlePayload } from "@/lib/types"
import { gameLabel } from "./game"

type ResultsProps = {
  payload: PuzzlePayload
  state: GameState
  answers: Array<BoardAnswer>
  rank: string | null
}

const plural = new Intl.PluralRules("cs-CZ")
const weekday = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", timeZone: "UTC" })
const pick = (n: number, one: string, few: string, many: string) => {
  const category = plural.select(n)
  return category === "one" ? one : category === "few" ? few : many
}

export function Results({ payload, state, answers, rank }: ResultsProps) {
  const { bonus, total } = scoreLines(state, answers)

  return (
    <section id="vysledek" className="scroll-mt-4 bg-ground-step text-foreground">
      <div className="page grid gap-12 pt-24 pb-16 md:grid-cols-12 md:gap-6 md:pt-36 md:pb-24">
        <div className="flex flex-col md:col-span-6">
          <h2 className="head reveal">Váš výsledek</h2>
          <div className="reveal mt-12 md:mt-auto md:pt-16">
            <p className="giant">{total}</p>
            <p className="mt-5">
              {pointsWord(total)} z {maxScore(answers)} možných · {state.found.length} z {answers.length} odpovědí ·{" "}
              {state.strikes} {pick(state.strikes, "chyba", "chyby", "chyb")}
            </p>
          </div>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <div className="zigzag-bottom bg-paper px-6 pt-7 pb-14 text-ink md:px-8">
            <p className="font-semibold">Rozpis bodů · {gameLabel(payload)}</p>
            <ul className="mt-5 grid gap-2.5">
              {answers.map((answer, index) => {
                const found = state.found.includes(index)
                const hints = hintsUsed(state, index)
                return (
                  <li key={answer.rank} className={`flex items-baseline gap-2 ${found ? "" : "text-ink-soft"}`}>
                    <span className="truncate">
                      {answer.rank}. {answer.text}
                      {found && hints > 0 && <span className="text-ink-soft"> · {hints} {hints === 1 ? "písmeno" : "písmena"}</span>}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{found ? pointsFor(answer.votes, hints) : 0}</span>
                  </li>
                )
              })}
              <li className="flex items-baseline gap-2 font-semibold">
                <span>Celá tabule</span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">{bonus}</span>
              </li>
            </ul>
            <p className="inverted-row -mx-6 mt-5 px-6 md:-mx-8 md:px-8">
              <span>Celkem</span>
              <span className="leader" aria-hidden />
              <span className="tabular-nums">{total}</span>
            </p>
          </div>
        </div>
      </div>

      <Share payload={payload} state={state} answers={answers} total={total} rank={rank} />
    </section>
  )
}

function Share({
  payload,
  state,
  answers,
  total,
  rank,
}: {
  payload: PuzzlePayload
  state: GameState
  answers: Array<BoardAnswer>
  total: number
  rank: string | null
}) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState("")
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])

  const path = payload.kind === "custom" ? `/vlastni/${payload.id}` : `/hra/${payload.date}`
  const url = `${origin}${path}`
  const text = shareText({ label: gameLabel(payload), question: payload.question, state, answers, total, url, challenge: true, rank })
  const fileName = `co-na-to-ai-${payload.kind === "custom" ? payload.id : payload.date}.png`

  async function image(): Promise<Blob | null> {
    const node = ticketRef.current
    if (!node) return null
    return domToBlob(node, { scale: 1200 / node.offsetWidth, type: "image/png" })
  }

  async function share() {
    try {
      const blob = await image()
      const file = blob ? new File([blob], fileName, { type: "image/png" }) : null
      if (file && "canShare" in navigator && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
      if ("share" in navigator) {
        await navigator.share({ text })
        return
      }
      await copy()
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      await copy()
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus("Výsledek je ve schránce.")
    } catch {
      setStatus("Text se nepodařilo zkopírovat. Stáhněte si raději obrázek.")
    }
  }

  async function download() {
    const blob = await image()
    if (!blob) return
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.click()
    URL.revokeObjectURL(link.href)
    setStatus("Obrázek je stažený.")
  }

  return (
    <div className="page grid gap-10 pb-24 md:grid-cols-12 md:gap-6 md:pb-40">
      <div className="md:col-span-7">
        <Ticket ref={ticketRef} payload={payload} state={state} answers={answers} total={total} rank={rank} host={origin.replace(/^https?:\/\//, "")} />
      </div>
      <div className="flex flex-col gap-6 md:col-span-4 md:col-start-9">
        <h2 className="head reveal">Vyzvěte kamarády</h2>
        <p>Pošlete jim svůj výsledek s odkazem na stejnou otázku a uvidíte, kdo zná AI líp. Obrázek ani text žádnou odpověď neprozradí.</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={share} className="h-12 px-6 text-base font-semibold">
            Vyzvat kamarády
          </Button>
          <Button onClick={copy} variant="secondary" className="h-12 bg-ground px-5 text-base text-foreground hover:bg-paper">
            Kopírovat text
          </Button>
          <Button onClick={download} variant="secondary" className="h-12 bg-ground px-5 text-base text-foreground hover:bg-paper">
            Stáhnout obrázek
          </Button>
        </div>
        <p aria-live="polite" className="min-h-[1.5em] text-sm">
          {status}
        </p>
      </div>
    </div>
  )
}

function Ticket({
  ref,
  payload,
  state,
  answers,
  total,
  rank,
  host,
}: {
  ref: React.Ref<HTMLDivElement>
  payload: PuzzlePayload
  state: GameState
  answers: Array<BoardAnswer>
  total: number
  rank: string | null
  host: string
}) {
  return (
    <div ref={ref} className="relative aspect-[1200/630] w-full text-ink [container-type:inline-size]">
      <svg viewBox="0 0 1200 630" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="none">
        <path d="M0 0 H836 A34 34 0 0 0 904 0 H1200 V630 H904 A34 34 0 0 0 836 630 H0 Z" fill="var(--paper)" />
        {Array.from({ length: 13 }, (_, i) => (
          <circle key={i} cx="870" cy={70 + i * 40} r="5" fill="var(--ground-step)" />
        ))}
        <rect x="0" y="0" width="22" height="630" fill="var(--red)" />
        <rect x="0" y="0" width="22" height="315" fill="var(--field)" />
      </svg>
      <div className="absolute inset-y-0 left-[6%] flex w-[62%] flex-col justify-between py-[5.5%]">
        <p
          className={`line-clamp-2 leading-[1.05] font-bold tracking-[-0.01em] [font-stretch:82%] ${
            payload.question.length > 72 ? "text-[3.3cqw]" : payload.question.length > 58 ? "text-[3.8cqw]" : "text-[4.6cqw]"
          }`}
        >
          {payload.question}
        </p>
        <div>
          <p className="text-[12cqw] leading-[0.8] font-bold tracking-[-0.04em] [font-stretch:75%]">
            {total}
            <span className="ml-[1.5cqw] text-[3.6cqw] tracking-normal [font-stretch:85%]">{pointsWord(total)}</span>
          </p>
          {rank && <p className="mt-[1.8cqw] text-[3.2cqw] leading-none font-semibold">{rank}</p>}
          <p className={`${rank ? "mt-[1cqw]" : "mt-[1.6cqw]"} text-[3.4cqw] leading-none font-semibold text-red`}>Překonáte mě?</p>
        </div>
        <div>
          <div className="flex items-center gap-[0.8cqw]">
            {answers.map((answer, index) => (
              <span key={answer.rank} className={`size-[3.6cqw] ${state.found.includes(index) ? "bg-field" : "bg-paper-step"}`} />
            ))}
            <span className="ml-[1.6cqw] flex gap-[0.5cqw]">
              {Array.from({ length: MAX_STRIKES }, (_, i) => (
                <svg key={i} viewBox="0 0 24 24" className={`size-[3cqw] ${i < state.strikes ? "text-red" : "text-paper-step"}`} aria-hidden>
                  <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              ))}
            </span>
          </div>
          <p className="mt-[1.8cqw] text-[3cqw] leading-none text-ink-soft">{host}</p>
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[24.6%] flex-col justify-between py-[5.5%] pr-[3cqw] pl-[2cqw]">
        <p className="text-[3.4cqw] leading-[1.05] font-bold [font-stretch:85%]">
          Co na to
          <br />
          AI
        </p>
        <div>
          <p className="text-[3cqw] leading-tight">{payload.kind === "custom" ? "Vlastní hra" : weekday.format(new Date(`${payload.date}T12:00:00Z`))}</p>
          <p className="mt-[1cqw] text-[9cqw] leading-[0.8] font-bold tracking-[-0.04em] [font-stretch:75%]">{formatDayMonth(payload.date)}</p>
        </div>
        <p className="text-[3cqw] leading-tight">
          {payload.date.slice(0, 4)} · {state.found.length} z {answers.length}
        </p>
      </div>
    </div>
  )
}
