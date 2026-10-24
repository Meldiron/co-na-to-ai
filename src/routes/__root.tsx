import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router"
import { SiteFooter } from "@/components/site-footer"
import { RevealObserver } from "@/components/reveal-observer"
import { SiteHeader } from "@/components/site-header"
import appCss from "../styles.css?url"

const themeScript = `document.documentElement.classList.add("js");try{var t=localStorage.getItem("pjs100:tema");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Ptali jsme se 100 AI · denní hra" },
      {
        name: "description",
        content: "Denní česká hra: sto umělých inteligencí odpovědělo na anketní otázku. Uhodnete jejich osm nejčastějších odpovědí? Tři chyby a konec.",
      },
      { name: "theme-color", content: "#11457e" },
      { property: "og:title", content: "Ptali jsme se 100 AI" },
      { property: "og:description", content: "Uhodnete, co odpověděla stovka umělých inteligencí? Nová otázka každý den." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "cs_CZ" },
      { property: "og:image", content: "/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: [{ children: themeScript }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <main className="bg-ground">{children}</main>
        <RevealObserver />
        <SiteFooter />
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page py-24 md:py-40">
        <h1 className="display">Tahle stránka neexistuje</h1>
        <p className="mt-5 max-w-[50ch]">Možná jste přišli z rozbitého odkazu. Dnešní otázka na vás čeká na úvodní stránce.</p>
        <Link to="/" className="mt-8 inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90">
          Na dnešní hru
        </Link>
      </section>
    </>
  )
}
