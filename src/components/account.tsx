import { Link } from "@tanstack/react-router"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { isValidDate } from "@/lib/day"
import { focusContainer } from "@/lib/focus"
import type { GameRef } from "@/lib/game-ref"
import { NAME_MAX, NAME_MIN, cleanName } from "@/lib/players"
import {
  forgetLocalGames,
  loadResults,
  localGames,
  markSynced,
  syncedFor,
} from "@/lib/storage"
import {
  getAccount,
  requestPasswordReset,
  saveMyGame,
  setName,
  signIn,
  signOut,
  signUp,
  type AccountUser,
} from "@/server/account-api"

const OPEN_EVENT = "pjs100:ucet"

type AccountValue = {
  enabled: boolean
  ready: boolean
  user: AccountUser | null
  refresh: () => Promise<AccountUser | null>
}

const AccountContext = createContext<AccountValue>({
  enabled: false,
  ready: false,
  user: null,
  refresh: async () => null,
})

export function useAccount(): AccountValue {
  return useContext(AccountContext)
}

type Mode = "signup" | "signin" | "reset"

export function openAccount(mode: Mode = "signup"): void {
  window.dispatchEvent(new CustomEvent<Mode>(OPEN_EVENT, { detail: mode }))
}

function refOf(key: string): GameRef | null {
  if (isValidDate(key)) return { kind: "daily", id: key }
  const custom = /^vlastni:([a-f0-9]{10})$/.exec(key)
  return custom ? { kind: "custom", id: custom[1] } : null
}

async function importLocalGames(): Promise<number> {
  const results = loadResults()
  let sent = 0
  for (const game of localGames()) {
    const ref = refOf(game.key)
    if (
      !ref ||
      (game.state.status === "playing" && game.state.guesses.length === 0)
    )
      continue
    try {
      await saveMyGame({
        data: {
          ref,
          board: game.board,
          state: game.state,
          daily: game.key in results && results[game.key].daily,
        },
      })
      sent++
    } catch {
      // the game stays in this browser and is offered again next visit
    }
  }
  return sent
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AccountValue, "refresh">>({
    enabled: false,
    ready: false,
    user: null,
  })
  const importing = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const account = await getAccount()
      setState({ enabled: account.enabled, ready: true, user: account.user })
      return account.user
    } catch {
      setState((s) => ({ ...s, ready: true }))
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!state.ready || !state.enabled || importing.current) return
    if (state.user && syncedFor() === state.user.id) return
    importing.current = true
    void importLocalGames().then(async (sent) => {
      const user = sent > 0 ? await refresh() : state.user
      if (user) markSynced(user.id)
      importing.current = false
    })
  }, [state.ready, state.enabled, state.user, refresh])

  return (
    <AccountContext.Provider value={{ ...state, refresh }}>
      {children}
    </AccountContext.Provider>
  )
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <Input
        id={id}
        className="h-12 border-0 bg-paper-step px-4 text-ink placeholder:text-ink-soft"
        {...props}
      />
    </div>
  )
}

function NameForm({
  user,
  onSaved,
}: {
  user: AccountUser | null
  onSaved: () => Promise<unknown>
}) {
  const [name, setNameValue] = useState(user?.named ? user.name : "")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const clean = cleanName(name)
  const valid = clean.length >= NAME_MIN && clean.length <= NAME_MAX

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await setName({ data: { name: clean } })
      await onSaved()
      setNote("Jméno je uložené.")
    } catch {
      setNote("Jméno se nepodařilo uložit.")
    }
    setBusy(false)
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <Field
        id="jmeno"
        label="Jméno v žebříčku"
        value={name}
        onChange={(e) => setNameValue(e.target.value)}
        maxLength={NAME_MAX}
        autoComplete="nickname"
        placeholder={user ? user.name : "Třeba Pepa z Brna"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={busy || !valid || clean === user?.name}
          variant="secondary"
          className="h-11 bg-paper-step px-5 font-semibold hover:bg-ground-step"
        >
          Uložit jméno
        </Button>
        <p aria-live="polite" className="text-sm text-ink-soft">
          {note || `Uvidí ho ostatní hráči. ${NAME_MIN} až ${NAME_MAX} znaků.`}
        </p>
      </div>
    </form>
  )
}

function Credentials({
  initial,
  onSignedUp,
}: {
  initial: Mode
  onSignedUp: () => Promise<unknown>
}) {
  const [mode, setMode] = useState<Mode>(initial)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      if (mode === "reset") {
        const result = await requestPasswordReset({ data: { email } })
        if (!result.ok) setError(result.error)
        else setSent(true)
      } else if (mode === "signup") {
        const result = await signUp({ data: { email, password } })
        if (!result.ok) setError(result.error)
        else await onSignedUp()
      } else {
        const result = await signIn({ data: { email, password } })
        if (!result.ok) setError(result.error)
        else {
          forgetLocalGames()
          window.location.reload()
          return
        }
      }
    } catch {
      setError(
        mode === "signup"
          ? "Zkontrolujte e-mail a heslo (aspoň 8 znaků)."
          : mode === "reset"
            ? "Zkontrolujte e-mail."
            : "Přihlášení se nepovedlo."
      )
    }
    setBusy(false)
  }

  function switchTo(next: Mode) {
    setMode(next)
    setError("")
    setSent(false)
  }

  return (
    <div className="grid gap-4">
      <div
        className="grid grid-cols-2 gap-[3px]"
        role="tablist"
        aria-label="Účet"
      >
        {(
          [
            ["signup", "Založit účet"],
            ["signin", "Mám účet"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id || (id === "signin" && mode === "reset")}
            onClick={() => switchTo(id)}
            className={`h-11 font-semibold transition-colors ${mode === id || (id === "signin" && mode === "reset") ? "bg-field text-field-ink" : "bg-paper-step hover:bg-ground-step"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-ink-soft">
          {mode === "signup"
            ? "Z hosta se stane trvalý účet. Hry, výsledky i série zůstanou a budete je mít na každém zařízení."
            : mode === "reset"
              ? "Pošleme vám e-mail s odkazem, přes který si nastavíte nové heslo."
              : "Hry z tohoto prohlížeče, které v účtu ještě nemáte, se do něj přesunou."}
        </p>
        <Field
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode !== "reset" && (
          <Field
            id="heslo"
            label="Heslo"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={mode === "signup" ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Aspoň 8 znaků" : undefined}
            required
          />
        )}
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => switchTo("reset")}
            className="justify-self-start text-sm font-semibold underline underline-offset-4"
          >
            Zapomněli jste heslo?
          </button>
        )}
        <p
          aria-live="polite"
          className={`min-h-[1.5em] font-semibold ${sent ? "text-field" : "text-red"}`}
        >
          {sent
            ? "Pokud k tomu e-mailu patří účet, přijde na něj odkaz na nové heslo. Platí hodinu."
            : error}
        </p>
        <Button
          type="submit"
          disabled={busy || !email || (mode !== "reset" && !password) || sent}
          className="h-12 justify-self-start px-8 font-semibold"
        >
          {busy
            ? "Chvilku…"
            : mode === "signup"
              ? "Založit účet"
              : mode === "reset"
                ? "Poslat odkaz"
                : "Přihlásit se"}
        </Button>
        {mode === "reset" && (
          <button
            type="button"
            onClick={() => switchTo("signin")}
            className="justify-self-start text-sm font-semibold underline underline-offset-4"
          >
            Zpět na přihlášení
          </button>
        )}
      </form>
    </div>
  )
}

export function AccountDialog() {
  const { enabled, user, refresh } = useAccount()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("signup")
  const member = user && !user.guest

  useEffect(() => {
    const show = (event: Event) => {
      setMode(
        event instanceof CustomEvent && typeof event.detail === "string"
          ? (event.detail as Mode)
          : "signup"
      )
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  async function leave() {
    await signOut()
    forgetLocalGames()
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onOpenAutoFocus={focusContainer}
        className="max-h-[calc(100svh-2rem)] gap-6 overflow-y-auto focus:outline-none sm:max-w-lg"
      >
        <div>
          <DialogTitle className="head">
            {member ? "Váš účet" : "Účet"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-base text-ink-soft">
            {!enabled
              ? "Účty teď nejsou k dispozici. Hrát můžete dál, výsledky se uloží v tomto prohlížeči."
              : member
                ? `Přihlášeni jako ${user.email}. Hry a série se ukládají k účtu.`
                : "Hrajete jako host. Hry a série se ukládají jen k tomuto prohlížeči, dokud si nezaložíte účet."}
          </DialogDescription>
        </div>
        {enabled && (
          <>
            <NameForm key={user?.id ?? "nikdo"} user={user} onSaved={refresh} />
            {member ? (
              <div className="flex flex-wrap gap-3">
                {user.admin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 items-center bg-field px-5 font-semibold text-field-ink hover:bg-field/90"
                  >
                    Administrace
                  </Link>
                )}
                <Button
                  onClick={leave}
                  variant="secondary"
                  className="h-11 bg-paper-step px-5 font-semibold hover:bg-red hover:text-red-ink"
                >
                  Odhlásit se
                </Button>
              </div>
            ) : (
              <Credentials key={mode} initial={mode} onSignedUp={refresh} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
