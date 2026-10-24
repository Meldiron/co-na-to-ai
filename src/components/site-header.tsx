import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { focusContainer } from "@/lib/focus"
import { openAccount, useAccount } from "./account"

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] font-bold whitespace-nowrap [font-stretch:85%] ${className}`}>
      Co na to
      <span className="relative inline-grid h-[1.45em] place-items-center bg-red px-[0.3em] text-red-ink [font-stretch:75%]">
        AI
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-red-ink/25" />
      </span>
    </span>
  )
}

function useAccountLabel(): string | null {
  const { enabled, user } = useAccount()
  if (!enabled) return null
  return user?.named ? user.name : "Účet"
}

const links = [
  { to: "/", label: "Dnešní hra" },
  { to: "/archiv", label: "Archiv" },
  { to: "/dotazani", label: "Dotázaní" },
] as const

function PhoneMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const account = useAccountLabel()
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center px-3 font-semibold md:hidden">
        Menu
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={focusContainer}
          className="top-0 left-0 h-[100svh] w-screen max-w-[100vw] translate-x-0 translate-y-0 content-start gap-8 bg-field px-[var(--margin)] py-0 text-field-ink sm:max-w-[100vw] data-open:zoom-in-100 data-closed:zoom-out-100"
        >
          <div className="flex h-16 items-center justify-between gap-4">
            <Wordmark />
            <DialogClose className="inline-flex h-11 items-center px-3 font-semibold">Zavřít</DialogClose>
          </div>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <DialogDescription className="sr-only">Hlavní navigace</DialogDescription>
          <nav aria-label="Hlavní" className="grid">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={close}
                activeOptions={{ exact: true }}
                className="head flex h-16 items-center underline-offset-[8px] data-[status=active]:underline"
              >
                {link.label}
              </Link>
            ))}
            <a href="/#pravidla" onClick={close} className="head flex h-16 items-center">
              Pravidla
            </a>
            {account && (
              <button
                type="button"
                onClick={() => {
                  close()
                  openAccount()
                }}
                className="head flex h-16 items-center truncate text-left"
              >
                {account}
              </button>
            )}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SiteHeader({ tone = "field" }: { tone?: "field" | "ground" }) {
  const account = useAccountLabel()
  return (
    <header className={tone === "field" ? "bg-field text-field-ink" : "bg-ground text-foreground"}>
      <div className="page flex h-16 items-center justify-between gap-4 md:h-20">
        <Link to="/" className="inline-flex h-11 items-center text-base md:text-[1.25rem]" aria-label="Co na to AI, dnešní hra">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Hlavní">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: true }}
              className="inline-flex h-11 items-center px-3 underline-offset-[6px] hover:underline data-[status=active]:underline"
            >
              {link.label}
            </Link>
          ))}
          <a href="/#pravidla" className="inline-flex h-11 items-center px-3 underline-offset-[6px] hover:underline">
            Pravidla
          </a>
          {account && (
            <button
              type="button"
              onClick={() => openAccount()}
              className={`ml-2 inline-flex h-11 max-w-[14rem] items-center truncate px-4 font-semibold transition-colors ${tone === "field" ? "bg-field-step hover:bg-board" : "bg-ground-step hover:bg-paper-step"}`}
            >
              {account}
            </button>
          )}
        </nav>
        <PhoneMenu />
      </div>
    </header>
  )
}
