// QA harness: screenshots every scenario at desktop and phone width with mocked browser state.
// usage: node qa/capture.mjs <base-url> <out-dir> [scenario-filter]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Browser, sleep } from "/Users/matejbaco/.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs"

const [base = "http://localhost:3000", out = "qa/shots/before", only = ""] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
)

const TODAY = "2026-10-24"
const BOARD = "Jídlo|Pivo|Oblečení|Spacák|Kniha|Nářadí|Deka|Telefon"
const game = (extra) => ({ found: [], guesses: [], strikes: 0, status: "playing", hints: [0, 0, 0, 0, 0, 0, 0, 0], clues: [], board: BOARD, ...extra })
const history = {
  "2026-10-17": { score: 620, found: 5, strikes: 5, cleared: false, daily: true },
  "2026-10-18": { score: 410, found: 4, strikes: 5, cleared: false, daily: true },
  "2026-10-19": { score: 880, found: 8, strikes: 2, cleared: true, daily: true },
  "2026-10-20": { score: 350, found: 6, strikes: 5, cleared: false, daily: true },
  "2026-10-21": { score: 700, found: 5, strikes: 5, cleared: false, daily: true },
  "2026-10-22": { score: 520, found: 6, strikes: 5, cleared: false, daily: true },
  "2026-10-23": { score: 905, found: 8, strikes: 1, cleared: true, daily: true },
}
const midGame = game({
  found: [0, 1],
  guesses: [
    { text: "jidlo", result: "hit", index: 0 },
    { text: "auto", result: "miss" },
    { text: "pivo", result: "hit", index: 1 },
    { text: "mobil", result: "miss" },
  ],
  strikes: 2,
  hints: [0, 0, 2, 0, 1, 0, 0, 0],
  clues: [3],
})
const lost = game({
  found: [0, 1, 3, 5],
  guesses: [
    { text: "jidlo", result: "hit", index: 0 },
    { text: "pivo", result: "hit", index: 1 },
    { text: "auto", result: "miss" },
    { text: "spacak", result: "hit", index: 3 },
    { text: "lyze", result: "miss" },
    { text: "kladivo", result: "hit", index: 5 },
    { text: "pes", result: "miss" },
    { text: "kolo", result: "miss" },
    { text: "stan", result: "miss" },
  ],
  strikes: 5,
  status: "lost",
  hints: [0, 0, 0, 1, 0, 0, 0, 0],
  clues: [2],
})
const won = game({
  found: [0, 1, 2, 3, 4, 5, 6, 7],
  guesses: ["jidlo", "pivo", "obleceni", "spacak", "kniha", "naradi", "deka", "telefon"].map((text, index) => ({ text, result: "hit", index })),
  strikes: 1,
  status: "won",
  hints: [0, 0, 0, 0, 1, 0, 2, 0],
})

const scenarios = [
  { id: "home-fresh", url: "/", shots: [{ at: "top" }, { at: "#dalsi-otazka" }, { at: "#pravidla" }, { at: "footer" }] },
  { id: "home-midgame", url: "/", storage: { [`hra:${TODAY}`]: midGame }, shots: [{ at: "top" }] },
  { id: "home-hint-menu", url: "/", storage: { [`hra:${TODAY}`]: midGame }, act: "openHint", shots: [{ at: "board" }] },
  { id: "home-hint-clue", url: "/", storage: { [`hra:${TODAY}`]: midGame }, act: "openClue", shots: [{ at: "board" }] },
  { id: "home-keyboard-focus", url: "/", act: "tabToHint", shots: [{ at: "board" }] },
  { id: "home-wrong-guess", url: "/", act: "wrongGuess", shots: [{ at: "board" }] },
  { id: "home-multiword", url: "/", act: "multiword", shots: [{ at: "board" }] },
  { id: "home-lost", url: "/", storage: { [`hra:${TODAY}`]: lost, vysledky: { ...history, [TODAY]: { score: 345, found: 4, strikes: 5, cleared: false, daily: true } } }, shots: [{ at: "top" }, { at: "#vysledek" }, { at: "ticket" }, { at: "#kdo-co-rekl" }, { at: "#dalsi-otazka" }] },
  { id: "home-won", url: "/", storage: { [`hra:${TODAY}`]: won, vysledky: { ...history, [TODAY]: { score: 1185, found: 8, strikes: 1, cleared: true, daily: true } } }, shots: [{ at: "top" }, { at: "#vysledek" }, { at: "ticket" }] },
  { id: "share-actions", url: "/", storage: { [`hra:${TODAY}`]: lost }, act: "shareAll", shots: [{ at: "ticket" }] },
  { id: "persona-dialog", url: "/", storage: { [`hra:${TODAY}`]: lost }, act: "openPersona", shots: [{ at: "viewport" }] },
  { id: "stats-history", url: "/", storage: { vysledky: history }, shots: [{ at: "#dalsi-otazka" }] },
  { id: "new-day-notice", url: "/", clockShiftHours: 14, shots: [{ at: "top" }] },
  { id: "archive", url: "/archiv", storage: { vysledky: history }, shots: [{ at: "top" }] },
  { id: "archive-game", url: "/hra/2026-10-19", shots: [{ at: "top" }] },
  { id: "cast", url: "/obsazeni", shots: [{ at: "top" }, { at: "section:nth-of-type(3)" }] },
  { id: "custom-game", url: "/vlastni/7d73a5b207", shots: [{ at: "top" }] },
  { id: "custom-missing", url: "/vlastni/0000000000", shots: [{ at: "top" }] },
  { id: "future-date", url: "/hra/2027-01-01", shots: [{ at: "top" }] },
  { id: "invalid-date", url: "/hra/nesmysl", shots: [{ at: "top" }] },
  { id: "before-launch", url: "/hra/2026-10-01", shots: [{ at: "top" }] },
  { id: "not-found", url: "/tohle-neexistuje", shots: [{ at: "top" }] },
  { id: "admin-login", url: "/admin", shots: [{ at: "top" }] },
  { id: "admin-wrong", url: "/admin", act: "wrongPassword", shots: [{ at: "top" }] },
  { id: "admin-dashboard", url: "/admin", act: "login", shots: [{ at: "top" }, { at: "section:nth-of-type(2)" }] },
]

const widths = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
]

const mocks = (shiftHours) => `
  ${shiftHours ? `(() => { const Real = Date; const shift = ${shiftHours} * 3600000;
    class Shifted extends Real { constructor(...a) { if (a.length === 0) super(Real.now() + shift); else super(...a) } static now() { return Real.now() + shift } }
    globalThis.Date = Shifted })();` : ""}
  navigator.share = async (data) => { window.__shared = data };
  navigator.canShare = () => false;
  try { Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.__copied = t } }, configurable: true }) } catch {}
  const realCreate = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blobSize = b.size; return realCreate.call(URL, b) };
`

const actions = {
  async openHint(page) {
    await page.eval(() => document.querySelector('[aria-label="Nápověda k odpovědi číslo 3"]')?.click())
    await sleep(600)
  },
  async openClue(page) {
    await page.eval(() => document.querySelector('[aria-label="Nápověda k odpovědi číslo 5"]')?.click())
    await sleep(500)
    await page.eval(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Kdo to řekl?"))?.click())
    await sleep(600)
  },
  async tabToHint(page) {
    await page.eval(() => document.querySelector('[aria-label="Nápověda k odpovědi číslo 1"]')?.focus({ focusVisible: true }))
    for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 })
    await sleep(400)
  },
  async wrongGuess(page) {
    await guess(page, "lednice")
    await sleep(250)
  },
  async multiword(page) {
    await type(page, "spací pytel")
    await sleep(400)
  },
  async shareAll(page) {
    for (const label of ["Kopírovat text", "Stáhnout obrázek", "Sdílet výsledek"]) {
      await page.eval((l) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(l))?.click(), label)
      await sleep(2500)
    }
  },
  async openPersona(page) {
    await page.eval(() => document.querySelector("#kdo-co-rekl li button")?.click())
    await sleep(900)
  },
  async wrongPassword(page) {
    await type(page, "spatne-heslo", "#heslo")
    await page.eval(() => document.querySelector("form button[type=submit]")?.click())
    await sleep(1800)
  },
  async login(page) {
    await type(page, env.ADMIN_PASSWORD, "#heslo")
    await page.eval(() => document.querySelector("form button[type=submit]")?.click())
    await sleep(2500)
  },
}

async function type(page, text, selector = "#tip") {
  await page.eval(
    ([t, s]) => {
      const el = document.querySelector(s)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, t)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    },
    [text, selector],
  )
}

async function guess(page, text) {
  await type(page, text)
  await sleep(100)
  await page.eval(() => document.querySelector("#tip")?.form?.requestSubmit())
}

async function scrollTo(page, at, height) {
  if (at === "top" || at === "viewport") return page.eval(() => window.scrollTo(0, 0))
  if (at === "board") return page.eval(() => document.querySelector("section[aria-label='Tabule odpovědí']")?.scrollIntoView({ block: "start" }))
  if (at === "ticket") return page.eval(() => document.querySelector("svg[viewBox='0 0 1200 630']")?.parentElement?.scrollIntoView({ block: "center" }))
  return page.eval((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), at)
}

const report = []
const browser = await Browser.launch({ width: 1440, height: 900 })
for (const w of widths) {
  const page = await browser.newPage({ width: w.width, height: w.height, mobile: w.mobile })
  await page.send("Runtime.enable")
  let logs = []
  browser.on(page.sessionId, "Runtime.consoleAPICalled", (e) => {
    if (e.type === "error" || e.type === "warning") logs.push(`${e.type}: ${e.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300)}`)
  })
  browser.on(page.sessionId, "Runtime.exceptionThrown", (e) => logs.push(`exception: ${(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text).slice(0, 300)}`))

  for (const s of scenarios) {
    if (only && !s.id.includes(only)) continue
    logs = []
    await page.send("Network.clearBrowserCookies")
    const script = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: mocks(s.clockShiftHours ?? 0) })
    await page.goto(`${base}/archiv`, { settleMs: 200 })
    await page.eval((storage) => {
      localStorage.clear()
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(`pjs100:${k}`, JSON.stringify(v))
    }, s.storage ?? {})
    await page.goto(`${base}${s.url}`, { settleMs: 2600 })
    if (s.act) await actions[s.act](page)
    const checks = await page.eval((mobile) => {
      const overflow = document.documentElement.scrollWidth - window.innerWidth
      const small = mobile
        ? [...document.querySelectorAll("a, button, input")]
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40))
            .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`)
        : []
      return { overflow, small: [...new Set(small)].slice(0, 12), title: document.title, h1: document.querySelector("h1")?.textContent ?? null }
    }, w.mobile)
    let n = 0
    for (const shot of s.shots) {
      await scrollTo(page, shot.at, w.height)
      await sleep(700)
      const file = `${s.id}-${n++}-${w.name}.jpg`
      await page.screenshot({ path: join(out, file), quality: 72 })
    }
    const extras = await page.eval(() => ({ copied: window.__copied ?? null, shared: window.__shared ?? null, blob: window.__blobSize ?? null }))
    report.push({ scenario: s.id, width: w.name, url: s.url, ...checks, logs: [...new Set(logs)].slice(0, 10), extras })
    await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier })
  }
  await page.close()
}
await browser.close()
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2))
console.log(`captured ${report.length} scenario runs into ${out}`)
