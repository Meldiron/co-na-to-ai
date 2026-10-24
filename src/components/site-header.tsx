import { Link } from "@tanstack/react-router"

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] font-bold whitespace-nowrap [font-stretch:85%] ${className}`}>
      Ptali jsme se
      <span className="relative inline-grid h-[1.45em] place-items-center bg-red px-[0.3em] text-red-ink [font-stretch:75%]">
        100
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-red-ink/25" />
      </span>
      AI
    </span>
  )
}

const links = [
  { to: "/", label: "Dnešní hra", phone: false },
  { to: "/archiv", label: "Archiv", phone: true },
  { to: "/obsazeni", label: "Obsazení", phone: false },
] as const

export function SiteHeader({ tone = "field" }: { tone?: "field" | "ground" }) {
  return (
    <header className={tone === "field" ? "bg-field text-field-ink" : "bg-ground text-foreground"}>
      <div className="page flex h-16 items-center justify-between gap-4 md:h-20">
        <Link to="/" className="text-base md:text-[1.25rem]" aria-label="Ptali jsme se 100 AI, dnešní hra">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1 md:gap-2" aria-label="Hlavní">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: true }}
              className={`${link.phone ? "inline-flex" : "hidden md:inline-flex"} h-11 items-center px-3 underline-offset-[6px] hover:underline data-[status=active]:underline`}
            >
              {link.label}
            </Link>
          ))}
          <a href="/#pravidla" className="hidden h-11 items-center px-3 underline-offset-[6px] hover:underline md:inline-flex">
            Pravidla
          </a>
        </nav>
      </div>
    </header>
  )
}
