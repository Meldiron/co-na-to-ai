// End-to-end account flow against a running site. Creates a real test user (qa-<time>@example.com).
// usage: node qa/accounts.mjs <base-url> [out-dir]
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { Browser, sleep } from "/Users/matejbaco/.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs"

const [base = "http://localhost:3000", out = "qa/shots/accounts"] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const stamp = Date.now()
const email = `qa-${stamp}@example.com`
const password = `Qa-${stamp}-${Math.random().toString(36).slice(2, 10)}`
const name = `QA ${String(stamp).slice(-4)}`
let failures = 0

const browser = await Browser.launch({ width: 1280, height: 900 })
const page = await browser.newPage({ width: 1280, height: 900, mobile: false })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` · ${detail}` : ""}`)
  if (!ok) failures++
}

const sessionCookie = async () => (await page.send("Network.getAllCookies")).cookies.find((c) => c.name === "pjs100_session")
const headerButtons = () => page.eval(() => [...document.querySelectorAll("header nav button")].map((b) => b.textContent.trim()))
const text = (selector) => page.eval((s) => document.querySelector(s)?.textContent ?? "", selector)

async function click(label, scope = "body") {
  const clicked = await page.eval(
    ([l, s]) => {
      const el = [...document.querySelectorAll(`${s} button, ${s} a`)].find((b) => b.textContent.trim() === l)
      el?.click()
      return !!el
    },
    [label, scope],
  )
  if (!clicked) throw new Error(`No button "${label}" in ${scope}`)
}

async function type(selector, value) {
  await page.eval(
    ([s, v]) => {
      const el = document.querySelector(s)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    },
    [selector, value],
  )
}

async function guess(word) {
  await type("#tip", word)
  await sleep(100)
  await page.eval(() => document.querySelector("#tip")?.form?.requestSubmit())
  await sleep(700)
}

await page.send("Network.clearBrowserCookies")
await page.goto(`${base}/archiv`, { settleMs: 300 })
await page.eval(() => {
  localStorage.clear()
  localStorage.setItem("pjs100:navod", "true")
})
await page.goto(`${base}/`, { settleMs: 3000 })

check("header offers the account", (await headerButtons()).includes("Účet"), (await headerButtons()).join(", "))
check("no guest before the first move", !(await sessionCookie()))

await guess("pivo")
await sleep(2500)
const guest = await sessionCookie()
check("a guest session after the first move", !!guest, guest ? `httpOnly=${guest.httpOnly}` : "")

await click("Účet", "header nav")
await sleep(700)
await type("#jmeno", name)
await click("Uložit jméno", "[role=dialog]")
await sleep(2500)
check("the name shows in the header", (await headerButtons()).includes(name), (await headerButtons()).join(", "))

await type("#email", email)
await type("#heslo", password)
await page.eval(() => document.querySelector("#email")?.form?.requestSubmit())
await sleep(3500)
const description = await text("[role=dialog] p")
check("the guest is claimed with email and password", description.includes("Přihlášeni jako"), description)
await page.screenshot({ path: join(out, "1-account.jpg"), quality: 72 })
await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 })
await sleep(500)

await page.eval(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("pjs100:hra:") || k === "pjs100:vysledky") localStorage.removeItem(k)
})
await page.goto(`${base}/`, { settleMs: 3500 })
const restored = await page.eval(() => document.querySelector("section[aria-label='Tabule odpovědí']")?.textContent ?? "")
check("progress comes back from the account after clearing the browser", /PIVO/i.test(restored))

for (const word of ["lednice", "klavír", "tramvaj", "sopka", "žirafa"]) await guess(word)
await sleep(4000)
const others = await text("#ostatni")
check("other players are shown after the game", others.includes("Jak hráli ostatní"))
check("the player is on the leaderboard", others.includes(name), others.slice(0, 160))
await page.eval(() => document.querySelector("#ostatni")?.scrollIntoView({ block: "start" }))
await sleep(600)
await page.screenshot({ path: join(out, "2-others.jpg"), quality: 72 })
await page.eval(() => document.querySelector("#dalsi-otazka")?.scrollIntoView({ block: "start" }))
await sleep(800)
const slip = await text("#dalsi-otazka")
check("the stats slip shows freezes and the account", slip.includes("Zmrazení") && slip.includes("k vašemu účtu"))
await page.screenshot({ path: join(out, "3-stats.jpg"), quality: 72 })

await click(name, "header nav")
await sleep(700)
await click("Odhlásit se", "[role=dialog]")
await sleep(3500)
check("signing out ends the session", !(await sessionCookie()))
check("signing out clears the board in this browser", await page.eval(() => !document.querySelector("#ostatni")))

await click("Účet", "header nav")
await sleep(700)
await click("Mám účet", "[role=dialog]")
await sleep(300)
await type("#email", email)
await type("#heslo", password)
await page.eval(() => document.querySelector("#email")?.form?.requestSubmit())
await sleep(4500)
check("signing in again restores the finished game", await page.eval(() => !!document.querySelector("#vysledek")))
check("the header shows the name after signing in", (await headerButtons()).includes(name))

await page.goto(`${base}/admin`, { settleMs: 2500 })
const gate = await text("main")
check("a player without the admin label sees the gate", gate.includes("nemá roli správce"))
await page.screenshot({ path: join(out, "4-admin-gate.jpg"), quality: 72 })

await browser.close()
console.log(`\n${failures ? `${failures} failed` : "all passed"} · test user ${email}`)
process.exit(failures ? 1 : 0)
