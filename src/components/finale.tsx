import { Link } from "@tanstack/react-router"
import { useEffect, useRef, useState, type SyntheticEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { celebrate } from "@/lib/celebrate"
import { FINALE_GOAL, FINALE_SECONDS, FINALE_SLOTS, finaleNumber, finaleShareText, weekLabel } from "@/lib/finale"
import { pointsWord } from "@/lib/game"
import type { FinaleLeaderboard, FinaleView } from "@/server/finale"
import { answerFinaleQuestion, getFinaleLeaderboard, getFinaleState, startFinaleGame } from "@/server/finale-api"
import { Flap } from "./flap"
import { SiteHeader } from "./site-header"

export type FinaleMeta = { week: string; current: boolean; enabled: boolean; ready: boolean; past: Array<string> }

type Playing = Extract<FinaleView, { status: "playing" }>
type Finished = Extract<FinaleView, { status: "finished" }>

const FAILED = "Odpověď se nepodařilo odeslat. Zkuste to znovu."

export function FinalePage({ meta }: { meta: FinaleMeta }) {
  const [view, setView] = useState<FinaleView | null>(null)
  const [leaders, setLeaders] = useState<FinaleLeaderboard | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState(false)
  const finished = view?.status === "finished"

  useEffect(() => {
    if (!meta.ready) return
    getFinaleState({ data: { week: meta.week } })
      .then(setView)
      .catch(() => setError("Finále se nepodařilo načíst."))
  }, [meta.week, meta.ready])

  useEffect(() => {
    if (!meta.enabled) return
    getFinaleLeaderboard({ data: { week: meta.week } })
      .then(setLeaders)
      .catch(() => undefined)
  }, [meta.week, meta.enabled, finished])

  function update(next: FinaleView) {
    if (next.status === "finished" && view?.status === "playing") {
      setFresh(true)
      if (next.score >= FINALE_GOAL && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) void celebrate()
    }
    setView(next)
  }

  async function start() {
    setBusy(true)
    setError("")
    try {
      update(await startFinaleGame({ data: { week: meta.week } }))
    } catch {
      setError("Finále se nepodařilo spustit. Zkuste to znovu.")
    }
    setBusy(false)
  }

  const kicker = `Finále č. ${finaleNumber(meta.week)} · ${weekLabel(meta.week)}`

  return (
    <>
      <SiteHeader />
      <section className="bg-field text-field-ink">
        <div className="page pt-5 pb-16 md:pt-12 md:pb-24">
          {!meta.enabled || !meta.ready ? (
            <Intro kicker={kicker} title={meta.enabled ? "Finále se připravuje" : "Finále teď není k dispozici"}>
              <p className="mt-5 max-w-[52ch]">{meta.enabled ? "Stovka AI ještě odpovídá na otázky. Zkuste to za chvíli." : "Zkuste to prosím později."}</p>
            </Intro>
          ) : view?.status === "playing" ? (
            <Play week={meta.week} view={view} onView={update} />
          ) : view?.status === "finished" ? (
            <Reveal week={meta.week} view={view} animate={fresh} />
          ) : (
            <Intro kicker={kicker} title={`Pět otázek, ${FINALE_SECONDS} sekund`}>
              <p className="mt-5 max-w-[56ch]">
                Na všech pět otázek máte dohromady {FINALE_SECONDS} sekund, na každou jednu odpověď. Body jsou počet AI, které řekly totéž. Na výhru potřebujete {FINALE_GOAL} bodů.
                {!meta.current && " Tohle finále už skončilo, do žebříčku se nepočítá."}
              </p>
              <Button onClick={start} disabled={busy || !view} className="mt-8 h-14 px-8 text-base font-semibold">
                {busy ? "Spouštím…" : "Začít finále"}
              </Button>
            </Intro>
          )}
          <p aria-live="polite" className="mt-4 min-h-[1.5em] font-semibold">
            {error}
          </p>
        </div>
      </section>
      <Leaders meta={meta} leaders={leaders} />
    </>
  )
}

function Intro({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="text-field-soft">{kicker}</p>
      <h1 className="display mt-3">{title}</h1>
      {children}
    </>
  )
}

function Play({ week, view, onView }: { week: string; view: Playing; onView: (view: FinaleView) => void }) {
  const [value, setValue] = useState("")
  const [left, setLeft] = useState(view.remainingMs)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef("")
  const sent = useRef<number | null>(null)
  const submit = useRef<(text: string) => void>(() => undefined)

  useEffect(() => {
    submit.current = (text: string) => {
      if (sent.current === view.slot) return
      sent.current = view.slot
      setPending(true)
      answerFinaleQuestion({ data: { week, slot: view.slot, text } })
        .then(onView)
        .catch(() => {
          sent.current = null
          setError(FAILED)
        })
        .finally(() => setPending(false))
    }
  })

  useEffect(() => {
    const deadline = Date.now() + view.remainingMs
    let expired = false
    valueRef.current = ""
    setValue("")
    setError("")
    inputRef.current?.focus()
    const timer = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now())
      setLeft(remaining)
      if (remaining > 0 || expired) return
      expired = true
      submit.current(valueRef.current)
    }, 100)
    return () => clearInterval(timer)
  }, [view.slot, view.remainingMs])

  function send(event: SyntheticEvent, text = valueRef.current) {
    event.preventDefault()
    submit.current(text)
    inputRef.current?.focus()
  }

  const seconds = Math.ceil(left / 1000)

  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <p className="text-field-soft">
          Otázka {view.slot + 1} z {FINALE_SLOTS}
        </p>
        <div role="timer" aria-label={`Zbývá ${seconds} s`}>
          <Flap text={String(seconds)} tone={seconds <= 5 ? "miss" : undefined} align="center" className="h-14 w-20 md:h-16 md:w-24" />
        </div>
      </div>
      <h1 className="display mt-3">{view.question}</h1>
      <p className="sr-only" aria-live="polite">
        Otázka {view.slot + 1} z {FINALE_SLOTS}: {view.question}
      </p>
      <div className="mt-6 h-2 bg-field-step" aria-hidden>
        <div className={`h-full ${seconds <= 5 ? "bg-red" : "bg-paper"}`} style={{ width: `${(left / (FINALE_SECONDS * 1000)) * 100}%` }} />
      </div>
      <form onSubmit={send} className="mt-6 flex min-w-0 flex-wrap gap-[3px] md:flex-nowrap" autoComplete="off">
        <label htmlFor="finale-odpoved" className="sr-only">
          Vaše odpověď
        </label>
        <Input
          id="finale-odpoved"
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/\s+/g, " ")
            valueRef.current = next
            setValue(next)
          }}
          placeholder="Odpověď…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          maxLength={40}
          disabled={pending}
          className="h-14 min-w-0 basis-full border-transparent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] md:h-16 md:flex-1 md:basis-auto"
        />
        <Button type="submit" disabled={pending} className="h-14 flex-1 px-8 text-base font-semibold md:h-16 md:flex-none">
          Odpovědět
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={(e) => send(e, "")}
          className="h-14 flex-1 bg-field-step px-6 text-base font-semibold text-field-ink hover:bg-board md:h-16 md:flex-none"
        >
          Nevím
        </Button>
      </form>
      <p aria-live="polite" className="mt-3 min-h-[1.5em] font-semibold">
        {error}
      </p>
    </div>
  )
}

function Reveal({ week, view, animate }: { week: string; view: Finished; animate: boolean }) {
  const [shown, setShown] = useState(!animate)
  const [status, setStatus] = useState("")
  const won = view.score >= FINALE_GOAL
  useEffect(() => setShown(true), [])

  async function share() {
    const text = finaleShareText(
      week,
      view.reveal.map((r) => r.answer),
      `${window.location.origin}/finale/${week}`,
    )
    try {
      if ("share" in navigator) {
        await navigator.share({ text })
        return
      }
      await copy(text)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      await copy(text)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus("Výsledek je ve schránce.")
    } catch {
      setStatus("Výsledek se nepodařilo zkopírovat.")
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-6">
      <div className="md:col-span-5">
        <p className="text-field-soft">
          Finále č. {finaleNumber(week)} · {weekLabel(week)}
        </p>
        <h1 className="display mt-3">{won ? "Finále vyhrané!" : "Konec finále"}</h1>
        <p className="giant mt-8">{view.score}</p>
        <p className="mt-4">
          {pointsWord(view.score)}
          {won ? `, cíl byl ${FINALE_GOAL}.` : `, do výhry chybělo ${FINALE_GOAL - view.score}.`}
          {!view.onTime && " Hráno mimo týden finále, do žebříčku se nepočítá."}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={share} className="h-12 px-6 text-base font-semibold">
            Sdílet výsledek
          </Button>
          <p aria-live="polite" className="text-sm">
            {status}
          </p>
        </div>
      </div>
      <ol className="grid gap-5 md:col-span-7 md:col-start-6" aria-label="Vaše odpovědi">
        {view.reveal.map((r, i) => {
          const delay = animate ? i * 650 : 0
          return (
            <li key={i}>
              <p className="text-sm text-field-soft">
                {i + 1}. {r.question}
              </p>
              <div className="mt-1.5 grid h-[48px] grid-cols-[1fr_4.5rem] gap-[3px] sm:h-[56px] md:grid-cols-[1fr_5.5rem]">
                <Flap text={shown ? r.matched ?? (r.answer.text || "—") : ""} tone={r.answer.points ? undefined : "dim"} delay={delay} className="h-full" />
                <Flap
                  text={shown ? String(r.answer.points) : ""}
                  tone={r.answer.index === 0 ? "key" : r.answer.points ? undefined : "dim"}
                  align="end"
                  delay={delay + 150}
                  className="h-full"
                />
              </div>
              <p className="mt-1.5 text-sm text-field-soft">
                {r.answer.late ? "Čas vypršel. " : ""}
                {r.answer.index === 0 ? "Nejčastější odpověď." : `Nejčastější: ${r.top.text} · ${r.top.votes}`}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Leaders({ meta, leaders }: { meta: FinaleMeta; leaders: FinaleLeaderboard | null }) {
  if ((!leaders || leaders.players === 0) && meta.past.length === 0) return null
  return (
    <section className="bg-ground text-foreground">
      <div className="page grid gap-12 py-20 md:grid-cols-12 md:gap-6 md:py-28">
        <div className="md:col-span-5">
          {leaders && leaders.players > 0 && (
            <div className="zigzag-bottom bg-paper px-6 pt-7 pb-14 text-ink md:px-8">
              <h2 className="font-semibold">Žebříček finále</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Vyhrálo {leaders.winners} z {leaders.players}
              </p>
              <ol className="mt-5 grid gap-2.5">
                {leaders.leaders.map((leader, i) => (
                  <li key={i} className={leader.me ? "inverted-row -mx-6 px-6 md:-mx-8 md:px-8" : "flex items-baseline gap-2"}>
                    <span className="truncate">
                      {leader.rank}. {leader.name}
                      {leader.me && " (vy)"}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{leader.score}</span>
                  </li>
                ))}
                {leaders.me && !leaders.leaders.some((l) => l.me) && (
                  <li className="inverted-row -mx-6 mt-2 px-6 md:-mx-8 md:px-8">
                    <span className="truncate">{leaders.me.rank}. Vy</span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{leaders.me.score}</span>
                  </li>
                )}
              </ol>
            </div>
          )}
        </div>
        {meta.past.length > 0 && (
          <div className="md:col-span-6 md:col-start-7">
            <h2 className="head">Další finále</h2>
            <ul className="mt-6 grid gap-[3px]">
              {meta.past.map((week) => (
                <li key={week}>
                  <Link
                    to="/finale/$tyden"
                    params={{ tyden: week }}
                    className="flex items-center justify-between gap-4 bg-paper px-4 py-3 font-semibold transition-colors hover:bg-paper-step"
                  >
                    Finále č. {finaleNumber(week)}
                    <span className="font-normal text-ink-soft">{weekLabel(week)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
