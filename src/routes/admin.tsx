import { Link, createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useState, type FormEvent } from "react"
import { Flap } from "@/components/flap"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { modelOf } from "@/lib/cast"
import { formatShort } from "@/lib/day"
import { createCustomGame, getAdminState, getCustomJob, login, logout, removeCustomGame } from "@/server/admin-api"
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
      {state.authed ? <Dashboard state={state} /> : <Login />}
    </>
  )
}

function Login() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const { ok } = await login({ data: { password } })
    setBusy(false)
    if (!ok) {
      setError("Špatné heslo.")
      setPassword("")
      return
    }
    await router.invalidate()
  }

  return (
    <section className="page grid gap-10 pt-8 pb-24 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-40">
      <div className="md:col-span-6">
        <h1 className="display">Administrace</h1>
        <p className="mt-5 max-w-[44ch]">Tady se zakládají vlastní hry: položíte stovce AI svou otázku a dostanete odkaz, který můžete poslat dál.</p>
      </div>
      <form onSubmit={submit} className="self-end md:col-span-5 md:col-start-8">
        <label htmlFor="heslo" className="font-semibold">
          Heslo
        </label>
        <div className="mt-2 flex">
          <Input
            id="heslo"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 flex-1 border-0 bg-paper px-4 text-ink"
            aria-invalid={!!error}
            aria-describedby="heslo-chyba"
          />
          <Button type="submit" disabled={busy || !password} className="h-14 px-6 font-semibold">
            {busy ? "Ověřuji…" : "Přihlásit se"}
          </Button>
        </div>
        <p id="heslo-chyba" aria-live="polite" className="mt-3 min-h-[1.5em] font-semibold text-red">
          {error}
        </p>
      </form>
    </section>
  )
}

type State = Extract<Awaited<ReturnType<typeof getAdminState>>, { authed: true }>

function Dashboard({ state }: { state: State }) {
  const router = useRouter()
  const [question, setQuestion] = useState("")
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState("")
  const running = job?.state === "asking" || job?.state === "judging"

  useEffect(() => {
    if (!job || !running) return
    const timer = setInterval(async () => {
      const next = await getCustomJob({ data: { id: job.id } })
      if (!next) return
      setJob(next)
      if (next.state === "done") await router.invalidate()
    }, 1500)
    return () => clearInterval(timer)
  }, [job, running, router])

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
    await logout()
    await router.invalidate()
  }

  return (
    <>
      <section className="page grid gap-10 pt-8 pb-20 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-32">
        <div className="md:col-span-6">
          <h1 className="display">Vlastní hra</h1>
          <p className="mt-5 max-w-[46ch]">
            Položte stovce AI vlastní otázku. Za minutu až dvě z ní bude hra s vlastním odkazem. Do statistik ani do archivu se nepočítá.
          </p>
          <button type="button" onClick={signOut} className="mt-6 text-sm underline underline-offset-4 hover:text-red">
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
              <Flap text={job.state === "asking" ? String(job.done) : job.state === "judging" ? "100" : job.state === "done" ? "OK" : "!"} align="center" className="h-14 w-24 shrink-0" />
              <div>
                <p className="font-semibold">„{job.question}“</p>
                <p className="mt-1 text-flap-dim">
                  {job.state === "asking" && `Odpovídají AI: ${job.done} ze ${job.total}.`}
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
