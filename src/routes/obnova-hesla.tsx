import { createFileRoute } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { z } from "zod"
import { openAccount } from "@/components/account"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { completePasswordReset } from "@/server/account-api"

export const Route = createFileRoute("/obnova-hesla")({
  validateSearch: z.object({ userId: z.string().optional(), secret: z.string().optional() }),
  head: () => ({ meta: [{ title: "Nové heslo · Co na to AI" }, { name: "robots", content: "noindex" }] }),
  component: Reset,
})

function Reset() {
  const { userId, secret } = Route.useSearch()
  const [password, setPassword] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!userId || !secret) return
    if (password !== again) {
      setError("Hesla se neshodují.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await completePasswordReset({ data: { userId, secret, password } })
      if (result.ok) setDone(true)
      else setError(result.error)
    } catch {
      setError("Heslo musí mít aspoň 8 znaků.")
    }
    setBusy(false)
  }

  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page grid gap-10 pt-8 pb-24 md:grid-cols-12 md:gap-6 md:pt-12 md:pb-40">
        <div className="md:col-span-6">
          <h1 className="display">Nové heslo</h1>
          <p className="mt-5 max-w-[44ch]">
            {done
              ? "Heslo je změněné. Teď se s ním přihlaste a hry i série budou zase na svém místě."
              : userId && secret
                ? "Zvolte nové heslo k účtu. Musí mít aspoň 8 znaků."
                : "Tenhle odkaz je neúplný. Požádejte o nový v okně Účet pod Zapomněli jste heslo."}
          </p>
          {(done || !userId || !secret) && (
            <button
              type="button"
              onClick={() => openAccount(done ? "signin" : "reset")}
              className="mt-8 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90"
            >
              {done ? "Přihlásit se" : "Poslat nový odkaz"}
            </button>
          )}
        </div>
        {!done && userId && secret && (
          <form onSubmit={submit} className="grid gap-4 self-end md:col-span-5 md:col-start-8">
            {(
              [
                ["nove-heslo", "Nové heslo", password, setPassword],
                ["nove-heslo-znovu", "Heslo znovu", again, setAgain],
              ] as const
            ).map(([id, label, value, set]) => (
              <div key={id} className="grid gap-1.5">
                <label htmlFor={id} className="font-semibold">
                  {label}
                </label>
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="h-14"
                />
              </div>
            ))}
            <p aria-live="polite" className="min-h-[1.5em] font-semibold text-red">
              {error}
            </p>
            <Button type="submit" disabled={busy || password.length < 8 || !again} className="h-14 justify-self-start px-8 font-semibold">
              {busy ? "Ukládám…" : "Uložit heslo"}
            </Button>
          </form>
        )}
      </section>
    </>
  )
}
