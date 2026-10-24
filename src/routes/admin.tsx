import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { openAccount } from "@/components/account"
import { Flap } from "@/components/flap"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { modelOf } from "@/lib/cast"
import { formatShort } from "@/lib/day"
import type { GameRef } from "@/lib/game-ref"
import { forgetLocalGames } from "@/lib/storage"
import { getMissedGuesses, signOut as endSession } from "@/server/account-api"
import { createCustomGame, getAdminState, getCustomJob, getRefill, refillBank, removeCustomGame, reviewBankQuestion } from "@/server/admin-api"
import type { Job } from "@/server/custom"

export const Route = createFileRoute("/admin")({
  loader: () => getAdminState(),
  head: () => ({ meta: [{ title: "Administrace · Ptali jsme se 100 AI" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
})

const usd = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" })

function Admin() {
  const state = Route.useLoaderData()
  return (
    <>
      <SiteHeader tone="ground" />
      {state.authed ? <Dashboard state={state} /> : <Gate member={state.member} />}
    </>
  )
}

function Gate({ member }: { member: boolean }) {
  return (
    <section className="page grid gap-10 pt-8 pb-24 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-40">
      <div className="md:col-span-7">
        <h1 className="display">Administrace</h1>
        <p className="mt-5 max-w-[46ch]">
          {member
            ? "Tenhle účet nemá roli správce. Přihlaste se jiným účtem, nebo si roli nechte přidat."
            : "Tady se zakládají vlastní hry a kontrolují chybné tipy. Přihlaste se účtem, který má roli správce."}
        </p>
        <button type="button" onClick={() => openAccount("signin")} className="mt-8 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90">
          {member ? "Přepnout účet" : "Přihlásit se"}
        </button>
      </div>
    </section>
  )
}

type State = Extract<Awaited<ReturnType<typeof getAdminState>>, { authed: true }>

function Dashboard({ state }: { state: State }) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const running = job?.state === "asking" || job?.state === "judging"

  useEffect(() => {
    if (!job || !running) return
    const started = Date.now()
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    const poll = setInterval(async () => {
      try {
        const next = await getCustomJob({ data: { id: job.id, executionId: job.executionId } })
        if (!next) return
        setJob({ ...next, question: job.question })
        if (next.state === "done") await router.invalidate()
      } catch {
        // a missed poll is retried on the next tick
      }
    }, 2500)
    return () => {
      clearInterval(tick)
      clearInterval(poll)
    }
  }, [job?.id, job?.executionId, running, router])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      setJob(await createCustomGame({ data: { question } }))
      setQuestion("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hru se nepodařilo založit.")
    }
  }

  async function signOut() {
    await endSession()
    forgetLocalGames()
    window.location.reload()
  }

  return (
    <>
      <section className="page grid gap-10 pt-8 pb-20 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-32">
        <div className="md:col-span-6">
          <h1 className="display">Vlastní hra</h1>
          <p className="mt-5 max-w-[46ch]">
            Položte stovce AI vlastní otázku. Za minutu až dvě z ní bude hra s vlastním odkazem. Do statistik ani do archivu se nepočítá.
          </p>
          <button type="button" onClick={signOut} className="mt-6 inline-flex h-11 items-center bg-ground-step px-4 font-semibold transition-colors hover:bg-red hover:text-red-ink">
            Odhlásit se
          </button>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <form onSubmit={create} className="bg-field p-5 text-field-ink md:p-6">
            <label htmlFor="otazka" className="font-semibold">
              Otázka
            </label>
            <Input
              id="otazka"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Jmenujte něco, co…"
              maxLength={90}
              disabled={running}
              className="mt-2 h-14 border-0 bg-paper px-4 text-ink placeholder:text-ink-soft"
            />
            <p className="mt-3 text-sm text-field-soft">
              Nejlíp funguje otázka, na kterou lidé odpovídají různě, ale ne úplně náhodně: „Co si berete na chatu?“, ne „Jmenujte ovoce“. 8 až 90 znaků, stojí asi 0,10 až
              0,20 $.
            </p>
            <Button type="submit" disabled={running || question.trim().length < 8} className="mt-5 h-12 px-6 font-semibold">
              Zeptat se 100 AI
            </Button>
            {error && <p className="mt-3 font-semibold">{error}</p>}
          </form>

          {job && (
            <div className="mt-4 flex items-center gap-5 bg-board p-5 text-flap-ink" aria-live="polite">
              <Flap
                text={job.state === "asking" ? (job.done >= 0 ? String(job.done) : `${elapsed}s`) : job.state === "judging" ? "100" : job.state === "done" ? "OK" : "!"}
                align="center"
                className="h-14 w-24 shrink-0"
              />
              <div>
                <p className="font-semibold">„{job.question}“</p>
                <p className="mt-1 text-flap-dim">
                  {job.state === "asking" && (job.done >= 0 ? `Odpovídají AI: ${job.done} ze ${job.total}.` : "Ptáme se stovky AI a pak slučujeme odpovědi. Trvá to minutu až dvě.")}
                  {job.state === "judging" && "Všichni odpověděli, rozhodčí model slučuje odpovědi."}
                  {job.state === "done" && (
                    <>
                      Hotovo.{" "}
                      <Link to="/vlastni/$id" params={{ id: job.id }} className="font-semibold text-flap-ink underline underline-offset-4">
                        Otevřít hru
                      </Link>
                    </>
                  )}
                  {job.state === "failed" && `Nepovedlo se: ${job.error ?? "neznámá chyba"}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-ground-step">
        <div className="page py-20 md:py-32">
          <div className="grid gap-4 md:grid-cols-12 md:gap-6">
            <h2 className="head md:col-span-4">Vaše vlastní hry</h2>
            <p className="max-w-[56ch] md:col-span-7 md:col-start-6">Odkaz na hru můžete poslat komukoli. Hra, která neprošla kontrolou kvality, se dá hrát, jen bývá moc snadná nebo moc těžká.</p>
          </div>
          {state.games.length === 0 ? (
            <p className="mt-10 bg-ground p-6">Zatím tu žádná vlastní hra není. Založte první formulářem nahoře.</p>
          ) : (
            <ul className="mt-12 grid gap-4">
              {state.games.map((game) => (
                <CustomGameRow key={game.id} game={game} onDelete={() => router.invalidate()} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <Bank bank={state.bank} />

      <Misses days={state.days} games={state.games} />

      {state.today && (
        <section className="bg-board text-flap-ink">
          <div className="page grid gap-10 py-20 md:grid-cols-12 md:gap-6 md:py-32">
            <div className="md:col-span-5">
              <h2 className="head">Dnešní tabule</h2>
              <p className="mt-4 max-w-[44ch]">„{state.today.question}“ vyšla {formatShort(state.today.date)}. Tady je jízdní řád jejího běhu i odpovědi, takže si ji neprozraďte.</p>
            </div>
            <div className="md:col-span-5 md:col-start-8">
              <div className="zigzag-bottom bg-paper px-6 pt-6 pb-14 text-ink md:px-8">
                <p className="font-semibold">Jízdní řád dnešní tabule</p>
                <ul className="mt-4 grid gap-2">
                  {[
                    ["Odpověděly", `${state.today.answered} ze ${state.today.asked}`],
                    ["Různých odpovědí", String(state.today.meta.clusters)],
                    ["Nejčastější odpověď", `${Math.round(state.today.meta.topShare * 100)} %`],
                    ["Slučoval", modelOf(state.today.meta.judgeModel).name],
                    ["Cena", usd.format(state.today.meta.costUsd)],
                    ["Doba běhu", `${Math.round(state.today.meta.durationMs / 1000)} s`],
                  ].map(([label, value]) => (
                    <li key={label} className="flex items-baseline gap-2">
                      <span>{label}</span>
                      <span className="leader" aria-hidden />
                      <span className="tabular-nums">{value}</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-6">
                  <summary className="cursor-pointer font-semibold">Ukázat odpovědi</summary>
                  <ol className="mt-3 grid gap-1.5">
                    {state.today.top.map(([text, votes], i) => (
                      <li key={text} className="flex items-baseline gap-2">
                        <span>
                          {i + 1}. {text}
                        </span>
                        <span className="leader" aria-hidden />
                        <span className="tabular-nums">{votes}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function CustomGameRow({ game, onDelete }: { game: State["games"][number]; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}/vlastni/${game.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    await removeCustomGame({ data: { id: game.id } })
    onDelete()
  }

  return (
    <li className="grid gap-4 bg-ground p-5 md:grid-cols-12 md:gap-6 md:p-6">
      <div className="md:col-span-5">
        <Link to="/vlastni/$id" params={{ id: game.id }} className="text-[1.25rem] leading-tight font-bold underline-offset-4 hover:underline">
          {game.question}
        </Link>
        <p className="mt-2 text-muted-foreground">
          {dateTime.format(new Date(game.createdAt))} · odpovědělo {game.answered} · {usd.format(game.costUsd)}
        </p>
        <p className={`mt-2 font-semibold ${game.passed ? "" : "text-red"}`}>{game.passed ? "Prošla kontrolou kvality" : `Neprošla: ${game.flags.join("; ")}`}</p>
      </div>
      <p className="text-muted-foreground md:col-span-4">
        {game.top
          .slice(0, 8)
          .map(([text, votes]) => `${text} ${votes}`)
          .join(" · ")}
      </p>
      <div className="flex flex-wrap items-start gap-2 md:col-span-3 md:justify-end">
        <Button onClick={copy} variant="secondary" className="h-11 bg-ground-step px-4 hover:bg-paper">
          {copied ? "Zkopírováno" : "Kopírovat odkaz"}
        </Button>
        <Button onClick={remove} variant="secondary" className={`h-11 px-4 ${confirming ? "bg-red text-red-ink hover:bg-red/90" : "bg-ground-step hover:bg-paper"}`}>
          {confirming ? "Opravdu smazat" : "Smazat"}
        </Button>
      </div>
    </li>
  )
}

function Misses({ days, games }: { days: State["days"]; games: State["games"] }) {
  const options: Array<{ ref: GameRef; label: string }> = [
    ...days.map((d) => ({ ref: { kind: "daily" as const, id: d.date }, label: `${formatShort(d.date)} · ${d.question}` })),
    ...games.map((g) => ({ ref: { kind: "custom" as const, id: g.id }, label: `Vlastní · ${g.question}` })),
  ]
  const [selected, setSelected] = useState(0)
  const [data, setData] = useState<Awaited<ReturnType<typeof getMissedGuesses>> | null>(null)
  const target = selected < options.length ? options[selected].ref : null

  useEffect(() => {
    if (!target) return
    let cancelled = false
    setData(null)
    getMissedGuesses({ data: target })
      .then((next) => !cancelled && setData(next))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [target?.kind, target?.id])

  if (options.length === 0) return null
  const peak = Math.max(1, ...(data?.misses.map((m) => m.count) ?? [1]))

  return (
    <section className="bg-ground">
      <div className="page grid gap-10 py-20 md:grid-cols-12 md:gap-6 md:py-32">
        <div className="md:col-span-4">
          <h2 className="head">Chybné tipy</h2>
          <p className="mt-4 max-w-[40ch]">
            Slova, která hráči zkusili a na tabuli nebyla. Když se tu často opakuje něco, co měla hra uznat, patří to mezi synonyma té odpovědi.
          </p>
          <label htmlFor="hra-tipy" className="mt-8 block font-semibold">
            Hra
          </label>
          <select
            id="hra-tipy"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="mt-2 h-12 w-full bg-paper px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-field"
          >
            {options.map((option, i) => (
              <option key={`${option.ref.kind}-${option.ref.id}`} value={i}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          {!data ? (
            <p className="bg-ground-step p-6">Načítám tipy…</p>
          ) : data.misses.length === 0 ? (
            <p className="bg-ground-step p-6">Zatím tu žádný chybný tip není{data.players ? "" : ", hru ještě nikdo nehrál"}.</p>
          ) : (
            <>
              <p className="text-muted-foreground">
                {data.misses.length} různých slov z {data.players} her.
              </p>
              <ol className="mt-4 grid gap-1.5">
                {data.misses.slice(0, 60).map((miss) => (
                  <li key={miss.text} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3">
                    <span className="truncate font-semibold">{miss.text}</span>
                    <span className="h-6 bg-ground-step">
                      <span className="block h-full bg-field" style={{ width: `${(miss.count / peak) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{miss.count}×</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

const STATUS: Record<string, string> = { approved: "schválená", rejected: "vyřazená", used: "použitá", candidate: "čeká" }

function Bank({ bank }: { bank: State["bank"] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [refill, setRefill] = useState<{ executionId: string; status: string } | null>(null)
  const running = refill !== null && refill.status !== "completed" && refill.status !== "failed"
  const waiting = bank.pool.bundled + bank.pool.approved + bank.pool.candidates

  useEffect(() => {
    if (!refill || !running) return
    const timer = setInterval(async () => {
      try {
        const { status } = await getRefill({ data: { executionId: refill.executionId } })
        setRefill({ ...refill, status })
        if (status === "completed") await router.invalidate()
      } catch {
        // retried on the next tick
      }
    }, 4000)
    return () => clearInterval(timer)
  }, [refill, running, router])

  async function review(id: string, decision: "approved" | "rejected") {
    setBusy(id)
    await reviewBankQuestion({ data: { id, decision } })
    await router.invalidate()
    setBusy(null)
  }

  async function draft() {
    setRefill({ executionId: "", status: "waiting" })
    try {
      setRefill({ ...(await refillBank()), status: "waiting" })
    } catch {
      setRefill({ executionId: "", status: "failed" })
    }
  }

  return (
    <section className="bg-ground-step">
      <div className="page grid gap-10 py-20 md:grid-cols-12 md:gap-6 md:py-32">
        <div className="md:col-span-4">
          <h2 className="head">Zásobník otázek</h2>
          <p className="mt-4 max-w-[44ch]">
            Když otázka dne neprojde kontrolou kvality, hra sáhne do zálohy. Každou noc se záloha doplní na {bank.pool.target} otázek: model navrhne nové a 15 AI je na
            zkoušku zodpoví. Otázku, kde skoro všichni řeknou totéž, rovnou vyřadí.
          </p>
          <ul className="mt-6 grid gap-2 bg-ground p-5">
            {[
              ["Z balíčku", bank.pool.bundled],
              ["Schválené", bank.pool.approved],
              ["Čeká na schválení", bank.pool.candidates],
            ].map(([label, value]) => (
              <li key={label} className="flex items-baseline gap-2">
                <span>{label}</span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">{value}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-2 font-semibold">
              <span>V záloze celkem</span>
              <span className="leader" aria-hidden />
              <span className="tabular-nums">
                {waiting} z {bank.pool.target}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Schválené jdou na řadu před neschválenými. Neschválené se použijí, jen když ostatní dojdou.</p>
          <Button onClick={draft} disabled={running} className="mt-6 h-12 px-6 font-semibold">
            {running ? "Navrhuji…" : "Navrhnout nové otázky"}
          </Button>
          <p aria-live="polite" className="mt-3 min-h-[1.5em] text-sm">
            {refill?.status === "failed"
              ? "Nepovedlo se. Podrobnosti jsou v logu funkce maintenance."
              : running
                ? "Model navrhuje dvacet otázek a zkouší je na 15 AI. Trvá to pár minut."
                : refill?.status === "completed"
                  ? "Hotovo, nové otázky čekají vpravo."
                  : ""}
          </p>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          {bank.candidates.length === 0 ? (
            <p className="bg-ground p-6">Nic nečeká na schválení.</p>
          ) : (
            <ul className="grid gap-3">
              {bank.candidates.map((question) => (
                <li key={question.id} className="grid gap-4 bg-ground p-5 md:grid-cols-[1fr_auto] md:items-start">
                  <div>
                    <p className="text-[1.125rem] leading-snug font-bold">{question.text}</p>
                    {question.probe && (
                      <p className="mt-1.5 text-muted-foreground">
                        Zkouška na {question.probe.answered} AI: {question.probe.answers.map(([text, count]) => `${text} ${count}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => review(question.id, "approved")} disabled={busy === question.id} className="h-11 px-4">
                      Schválit
                    </Button>
                    <Button
                      onClick={() => review(question.id, "rejected")}
                      disabled={busy === question.id}
                      variant="secondary"
                      className="h-11 bg-ground-step px-4 hover:bg-paper"
                    >
                      Zamítnout
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {bank.recent.length > 0 && (
            <>
              <h3 className="mt-12 text-[1.25rem] font-bold">Naposledy rozhodnuté</h3>
              <ul className="mt-4 grid gap-2">
                {bank.recent.map((question) => (
                  <li key={question.id} className="flex items-baseline gap-2">
                    <span className="truncate">{question.text}</span>
                    <span className="leader" aria-hidden />
                    <span className="whitespace-nowrap text-muted-foreground">
                      {STATUS[question.status]}
                      {question.usedOn ? ` ${formatShort(question.usedOn)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
