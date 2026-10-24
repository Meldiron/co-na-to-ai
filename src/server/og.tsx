import "@tanstack/react-start/server-only"
import latin700 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff?inline"
import latin800 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?inline"
import latinExt700 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-ext-700-normal.woff?inline"
import latinExt800 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-ext-800-normal.woff?inline"
import { Resvg } from "@resvg/resvg-js"
import satori from "satori"
import { formatShort } from "@/lib/day"

const FONT_FILES = [
  { name: "Bricolage", weight: 700, url: latin700 },
  { name: "Bricolage", weight: 800, url: latin800 },
  { name: "Bricolage Ext", weight: 700, url: latinExt700 },
  { name: "Bricolage Ext", weight: 800, url: latinExt800 },
] as const

const weekday = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", timeZone: "UTC" })

const C = { field: "#11457e", board: "#091429", flap: "#1a2743", flapLow: "#141f37", key: "#11457e", keyLow: "#0d3a6c", red: "#d7141a", ink: "#ffffff" }

type Font = { name: string; data: ArrayBuffer; weight: 700 | 800; style: "normal" }
let fonts: Promise<Array<Font>> | null = null

function loadFonts() {
  fonts ??= Promise.all(
    FONT_FILES.map(async ({ name, weight, url }) => ({
      name,
      weight,
      style: "normal" as const,
      data: await (await fetch(url)).arrayBuffer(),
    })),
  )
  return fonts
}

function Tile({ children, background, low, grow = false }: { children: string; background: string; low: string; grow?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: grow ? "center" : "flex-start",
        flexGrow: grow ? 1 : 0,
        height: 60,
        padding: "0 18px",
        background: low,
        fontSize: 28,
        fontWeight: 800,
        textTransform: "uppercase",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 30, background }} />
      <div style={{ display: "flex", position: "relative" }}>{children}</div>
    </div>
  )
}

function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, fontWeight: 800, letterSpacing: "-0.01em" }}>
      Co na to
      <div style={{ display: "flex", marginLeft: size * 0.3, padding: `0 ${Math.round(size * 0.28)}px`, background: C.red }}>AI</div>
    </div>
  )
}

function HiddenBoard() {
  return (
    <div style={{ display: "flex", gap: 10, padding: 14, background: C.board }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: "flex", flexGrow: 1, gap: 4 }}>
          <Tile background={C.flap} low={C.flapLow}>
            {String(i + 1)}
          </Tile>
          <Tile background={C.key} low={C.keyLow} grow>
            ?
          </Tile>
        </div>
      ))}
    </div>
  )
}

async function render(children: React.ReactNode): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(
    <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: C.field, color: C.ink, fontFamily: "Bricolage, Bricolage Ext" }}>
      <div style={{ position: "absolute", top: 52, right: 64, bottom: 52, left: 64, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>{children}</div>
    </div>,
    { width: 1200, height: 630, fonts: await loadFonts() },
  )
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())
}

export function renderOgImage(puzzle: { date: string; question: string }): Promise<Uint8Array<ArrayBuffer>> {
  return render(
    <>
      <Wordmark size={34} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Tile background={C.flap} low={C.flapLow}>{weekday.format(new Date(`${puzzle.date}T12:00:00Z`))}</Tile>
          <Tile background={C.flap} low={C.flapLow}>{formatShort(puzzle.date)}</Tile>
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: puzzle.question.length > 42 ? 64 : 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em" }}>{puzzle.question}</div>
      </div>
      <HiddenBoard />
    </>,
  )
}

export function renderBrandImage(): Promise<Uint8Array<ArrayBuffer>> {
  return render(
    <>
      <Wordmark size={92} />
      <div style={{ display: "flex", maxWidth: 1000, fontSize: 50, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
        100 AI jsme se zeptali a teď hledáme osm nejčastějších odpovědí na otázku:
      </div>
      <HiddenBoard />
    </>,
  )
}
