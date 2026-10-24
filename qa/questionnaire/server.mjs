import { createServer } from "node:http"
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))
const REVIEW = resolve(HERE, "../review")
const ANSWERS = resolve(HERE, "../answers.json")
const PORT = Number(process.env.PORT ?? 4321)
const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".diff": "text/plain; charset=utf-8", ".json": "application/json" }

const readJson = (path, fallback) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

const shots = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => /\.(jpg|png)$/.test(f))
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    : []

const ORDER = ["onboarding", "mobile-input", "game-over", "tried-words", "mobile-nav", "who-said", "stats-empty", "archive", "share-boost", "tap-targets", "bad-dates", "share-link", "og-absolute", "admin-czech", "popover-focus"]

function manifest() {
  if (!existsSync(REVIEW)) return []
  const conflicts = readJson(join(REVIEW, "conflicts.json"), { conflicts: {} }).conflicts
  return readdirSync(REVIEW)
    .filter((id) => statSync(join(REVIEW, id)).isDirectory())
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map((id) => {
      const dir = join(REVIEW, id)
      const variants = readdirSync(dir)
        .filter((v) => v !== "before" && statSync(join(dir, v)).isDirectory())
        .map((v) => {
          const vdir = join(dir, v)
          const patch = existsSync(join(vdir, "patch.diff")) ? readFileSync(join(vdir, "patch.diff"), "utf8") : ""
          return {
            id: v,
            ...readJson(join(vdir, "meta.json"), {}),
            shots: shots(vdir),
            patch: patch ? `review/${id}/${v}/patch.diff` : null,
            files: [...patch.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]),
            added: (patch.match(/^\+(?!\+\+)/gm) ?? []).length,
            removed: (patch.match(/^-(?!--)/gm) ?? []).length,
            overlaps: conflicts[`${id}/${v}`] ?? [],
          }
        })
      return { id, ...readJson(join(dir, "improvement.json"), { title: id }), before: shots(join(dir, "before")), beforeMeta: readJson(join(dir, "before", "meta.json"), {}), variants }
    })
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" })
  res.end(body)
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  if (url.pathname === "/" || url.pathname === "/index.html") return send(res, 200, readFileSync(join(HERE, "index.html")), TYPES[".html"])
  if (url.pathname === "/api/manifest") return send(res, 200, JSON.stringify(manifest()))
  if (url.pathname === "/api/answers" && req.method === "GET") return send(res, 200, JSON.stringify(readJson(ANSWERS, { answers: {} })))
  if (url.pathname === "/api/answers" && req.method === "POST") {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      try {
        const data = JSON.parse(body)
        writeFileSync(ANSWERS, `${JSON.stringify({ updatedAt: new Date().toISOString(), answers: data.answers ?? {} }, null, 2)}\n`)
        send(res, 200, JSON.stringify({ ok: true }))
      } catch {
        send(res, 400, JSON.stringify({ ok: false }))
      }
    })
    return
  }
  if (url.pathname.startsWith("/review/")) {
    const file = normalize(join(REVIEW, decodeURIComponent(url.pathname.slice("/review/".length))))
    if (!file.startsWith(REVIEW) || !existsSync(file)) return send(res, 404, "Not found", "text/plain")
    return send(res, 200, readFileSync(file), TYPES[extname(file)] ?? "application/octet-stream")
  }
  send(res, 404, "Not found", "text/plain")
}).listen(PORT, "127.0.0.1", () => console.log(`Questionnaire on http://localhost:${PORT}`))
