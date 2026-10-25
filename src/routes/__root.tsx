import { HeadContent, Link, Scripts, createRootRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router"
import { AccountDialog, AccountProvider } from "@/components/account"
import { HowToPlay } from "@/components/how-to-play"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { SITE_URL } from "@/lib/site"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Co na to AI · denní hra" },
      {
        name: "description",
        content: "Denní česká hra na motivy Co na to Češi: 100 AI jsme se zeptali a teď hledáme osm nejčastějších odpovědí. Uhodnete je? Pět chyb a konec.",
      },
      { name: "theme-color", content: "#11457e" },
      { property: "og:title", content: "Co na to AI" },
      { property: "og:description", content: "100 AI jsme se zeptali a teď hledáme osm nejčastějších odpovědí. Nová otázka každý den." },
      { property: "og:site_name", content: "Co na to AI" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "cs_CZ" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: NotFound,
  errorComponent: Failure,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AccountProvider>
          <main className="bg-ground">{children}</main>
          <HowToPlay />
          <AccountDialog />
          <SiteFooter />
        </AccountProvider>
        <Scripts />
      </body>
    </html>
  )
}

function Failure({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <>
      <SiteHeader tone="ground" />
      <section className="page py-24 md:py-40">
        <h1 className="display">Něco se pokazilo</h1>
        <p className="mt-5 max-w-[50ch]">Stránku se teď nepodařilo načíst. Zkuste to prosím znovu, nebo se vraťte na dnešní hru.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              reset()
              void router.invalidate()
            }}
            className="inline-flex h-12 items-center bg-red px-6 font-semibold text-red-ink hover:bg-red/90"
          >
            Zkusit znovu
          </button>
          <Link to="/" className="inline-flex h-12 items-center bg-paper px-6 font-semibold transition-colors hover:bg-paper-step">
            Na dnešní hru
          </Link>
        </div>
      </section>
    </>
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
