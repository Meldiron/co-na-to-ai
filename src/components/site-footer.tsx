import { Link } from "@tanstack/react-router"

export function SiteFooter() {
  return (
    <footer className="bg-board text-flap-ink">
      <div className="page grid gap-16 pt-16 pb-5 md:min-h-[70svh] md:grid-rows-[auto_1fr_auto] md:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-12">
          <div className="col-span-2 md:col-span-3">
            <p className="font-semibold">Hra</p>
            <ul className="mt-3 grid grid-cols-2 gap-[3px] md:grid-cols-1">
              <li>
                <Link to="/" className="flex h-12 items-center bg-flap px-4 text-flap-ink transition-colors hover:bg-flap-hover">
                  Dnešní otázka
                </Link>
              </li>
              <li>
                <Link to="/archiv" className="flex h-12 items-center bg-flap px-4 text-flap-ink transition-colors hover:bg-flap-hover">
                  Archiv
                </Link>
              </li>
              <li>
                <Link to="/obsazeni" className="flex h-12 items-center bg-flap px-4 text-flap-ink transition-colors hover:bg-flap-hover">
                  Obsazení
                </Link>
              </li>
              <li>
                <a href="/#pravidla" className="flex h-12 items-center bg-flap px-4 text-flap-ink transition-colors hover:bg-flap-hover">
                  Pravidla
                </a>
              </li>
              <li>
                <Link to="/admin" className="flex h-12 items-center bg-flap px-4 text-flap-ink transition-colors hover:bg-flap-hover">
                  Administrace
                </Link>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="font-semibold">Nová otázka</p>
            <p className="mt-2 text-flap-dim">Každý den o půlnoci českého času. Stejná pro všechny.</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-semibold">Odpovědi</p>
            <p className="mt-2 text-flap-dim">Sto jazykových modelů přes OpenRouter, každý v roli jiného Čecha. Hra není spojená s žádnou televizní soutěží.</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-semibold">Pravidla ve zkratce</p>
            <p className="mt-2 text-flap-dim">Osm odpovědí na tabuli, pět životů, 10 bodů za každou AI. Odkryté písmeno ubere čtvrtinu.</p>
          </div>
        </div>
        <div />
        <div>
          <svg viewBox="0 0 1000 192" className="block w-full" role="img" aria-label="Ptali jsme se 100 AI">
            <text x="0" y="150" textLength="1000" lengthAdjust="spacing" fill="currentColor" fontWeight="700" style={{ fontSize: 175, fontStretch: "75%", letterSpacing: "-0.02em" }}>
              Ptali jsme se 100 AI
            </text>
          </svg>
          <p className="mt-5 text-sm text-flap-dim">© 2026 Ptali jsme se 100 AI · Písmo Bricolage Grotesque (OFL)</p>
        </div>
      </div>
    </footer>
  )
}
