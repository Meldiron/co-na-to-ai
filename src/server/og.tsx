import "@tanstack/react-start/server-only"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { Resvg } from "@resvg/resvg-js"
import satori from "satori"
import { formatShort } from "@/lib/day"

const require = createRequire(import.meta.url)
const weekday = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", timeZone: "UTC" })

const C = { field: "#11457e", board: "#091429", flap: "#1a2743", flapLow: "#141f37", key: "#11457e", keyLow: "#0d3a6c", red: "#d7141a", ink: "#ffffff" }

type Font = { name: string; data: Buffer; weight: 700 | 800; style: "normal" }
let fonts: Promise<Array<Font>> | null = null

function loadFonts() {
  fonts ??= Promise.all(
    (["latin", "latin-ext"] as const).flatMap((subset) =>
      ([700, 800] as const).map(async (weight) => ({
        name: "Bricolage",
        weight,
        style: "normal" as const,
        data: await readFile(require.resolve(`@fontsource/bricolage-grotesque/files/bricolage-grotesque-${subset}-${weight}-normal.woff`)),
      })),
    ),
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

export async function renderOgImage(puzzle: { date: string; question: string }): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(
    <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: C.field, color: C.ink, fontFamily: "Bricolage" }}>
      <div style={{ position: "absolute", top: 52, right: 64, bottom: 52, left: 64, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, letterSpacing: "-0.01em" }}>
          Ptali jsme se
          <div style={{ display: "flex", margin: "0 12px", padding: "0 10px", background: C.red }}>100</div>
          AI
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Tile background={C.flap} low={C.flapLow}>{weekday.format(new Date(`${puzzle.date}T12:00:00Z`))}</Tile>
            <Tile background={C.flap} low={C.flapLow}>{formatShort(puzzle.date)}</Tile>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: puzzle.question.length > 42 ? 64 : 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em" }}>{puzzle.question}</div>
        </div>
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
      </div>
    </div>,
    { width: 1200, height: 630, fonts: await loadFonts() },
  )
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())
}
