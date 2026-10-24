# Ptali jsme se 100 AI

Daily Czech guessing game in the spirit of Family Feud / *5 proti 5*. Every day one survey question goes to 100 AI answerers (a different OpenRouter model per answerer, each playing a different Czech persona). Their answers are merged, and the player guesses the 8 most common. Three wrong guesses and the game is over.

Stack: TanStack Start, React 19, Tailwind 4, shadcn/ui (radix). Node 22.18+ (the pipeline runs TypeScript directly with Node's type stripping).

## Run the game

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # matching, scoring, Prague day switch, stats, pipeline shapes
npm run build      # production build in dist/
```

Routes: `/` today's game, `/hra/YYYY-MM-DD` a past day, `/archiv` the archive, `/obsazeni` the cast of 100.

A new puzzle starts at 00:00 Europe/Prague. Puzzle #1 is 2026-10-24 (`LAUNCH_DATE` in `src/lib/day.ts`). The server only returns puzzles whose date is on or before today in Prague, so the client never receives future boards. The answers in a payload are XOR'd with a per-day key and base64-encoded, so they aren't readable at a glance. That is obfuscation, not security.

## The pipeline

```bash
echo 'OPENROUTER_API_KEY=sk-or-...' > .env

npm run pipeline                         # make sure today + the next 6 days have puzzles
npm run pipeline -- --days 14            # keep 14 days queued
npm run pipeline -- --date 2026-11-02    # one day
npm run pipeline -- --date 2026-11-02 --force   # redo a day
npm run pipeline -- --recluster 2026-11-02      # re-run only the judge on the saved answers
```

For each date the pipeline does five things:

1. Takes the question scheduled in `questions/YYYY-MM.json`.
2. Asks the 100 answerers in `data/answerers.json`. Each is a model + persona pair. The prompt is in Czech, temperature 0.9, and asks for one answer of 1–3 words as structured JSON when the model supports it, plain text otherwise. A failing model is retried, then replaced by a spare from `pipeline/lib/roster.ts`.
3. Sends the raw answers to the judge model (`JUDGE_MODEL`, default `anthropic/claude-opus-5.5`). The judge merges them into canonical answers with alias lists (inflections, diminutives, synonyms) and flags anything offensive. Every answer must be used exactly once, otherwise the judge is asked again.
4. Runs the quality gate: at least 80 answers, the top answer at 45 % or less, at least 8 answers with 2 or more votes, nothing offensive. A question that fails is marked `rejected`, and a reserve question (`questions/reserve-*.json`) is tried for that date instead.
5. Writes `puzzles/YYYY-MM-DD.json` (the board, the long tail, who said what, cost) and `runs/YYYY-MM-DD--<question>.json` (every raw response, attempt, latency and cost, plus the judge's output).

Each run prints the top 8, the top share, the cost and any gate flags.

`.github/workflows/puzzles.yml` tops the queue up every night and commits the new files. It needs the `OPENROUTER_API_KEY` repository secret.

## Adding questions

Questions live in `questions/YYYY-MM.json`:

```json
{ "id": "chata", "date": "2026-10-24", "text": "Co si berete s sebou na chatu?", "tags": ["chata"], "status": "approved" }
```

`status` is `draft | approved | used | rejected`; the pipeline only uses `approved` ones. The bank is dated through 2027-10-31 and has 50 undated reserves. A good question has an open but finite answer space. Avoid one obvious answer ("Jmenujte ovoce" gives 70 % jablko) and avoid hundreds of equally likely ones. Keep it under 70 characters.

## The cast

`data/personas.json` holds 100 Czech personas. `pipeline/lib/roster.ts` lists 100 distinct models plus spares. `npm run cast` pairs them, deterministically, into `data/answerers.json`. Keep persona ids stable, because old puzzles refer to them.

## Deploy

`npm run build` produces a TanStack Start server build in `dist/`. Puzzles are bundled into the server build, one chunk per day, so deploy again after the queue workflow commits new puzzles. Any host that runs TanStack Start (Node) works.

## Credits

Pragotron board photo: "Karlovy Vary dolní nádraží - Pragotron 2017" by PetrS., CC BY-SA 4.0, via Wikimedia Commons. Typeface: Bricolage Grotesque (OFL). Not affiliated with any TV show.
