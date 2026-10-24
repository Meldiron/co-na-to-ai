# Ptali jsme se 100 AI

Daily Czech guessing game in the spirit of Family Feud / *5 proti 5*. Every day one survey question goes to 100 AI answerers (a different OpenRouter model per answerer, each playing a different Czech persona). Their answers are merged, and the player guesses the 8 most common. Five wrong guesses and the game is over.

Scoring: an answer is worth 10 points per AI that gave it, and clearing the board adds 200. Tapping a hidden answer offers two clues. "Odkrýt písmeno" reveals the next letter, up to 3, and never the whole word; each one takes a quarter of that answer's points, so a hinted answer is always worth more than a miss and less than finding it with fewer letters. "Kdo to řekl?" is free: it describes the personas who gave the answer ("hlavně důchodci z Moravy") and names the youngest and the oldest.

Stack: TanStack Start, React 19, Tailwind 4, shadcn/ui (radix). Node 22.18+ (the pipeline runs TypeScript directly with Node's type stripping).

## Run the game

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # matching, scoring, Prague day switch, stats, pipeline shapes
npm run build      # production build in dist/
```

Routes: `/` today's game, `/hra/YYYY-MM-DD` a past day, `/archiv` the archive, `/obsazeni` the cast of 100, `/vlastni/<id>` a custom game, `/admin` the password-protected admin.

A new puzzle starts at 00:00 Europe/Prague. Puzzle #1 is 2026-10-01 (`LAUNCH_DATE` in `src/lib/day.ts`). The server only returns puzzles whose date is on or before today in Prague, so the client never receives future boards. The answers in a payload are XOR'd with a per-day key and base64-encoded, so they aren't readable at a glance. That is obfuscation, not security.

## The pipeline

```bash
echo 'OPENROUTER_API_KEY=sk-or-...' > .env

npm run pipeline                         # make sure today + the next 6 days have puzzles
npm run pipeline -- --days 14            # keep 14 days queued
npm run pipeline -- --date 2026-11-02    # one day
npm run pipeline -- --date 2026-11-02 --force   # redo a day
npm run pipeline -- --recluster 2026-11-02      # re-run only the judge on the saved answers
npm run pipeline -- --rejudge puzzles/2026-11-02.json   # re-cluster a published board from its stored answers
npm run pipeline -- --aliases puzzles/2026-11-02.json   # rewrite only the answer key (accepted guesses)
```

For each date the pipeline does five things:

1. Takes the question scheduled in `questions/YYYY-MM.json`.
2. Asks the 100 answerers in `data/answerers.json`. Each is a model + persona pair. The prompt is in Czech, temperature 0.9, and asks for a single word as structured JSON when the model supports it, plain text otherwise. The persona only lightly colours the answer. A failing model is retried, then replaced by a spare from `pipeline/lib/roster.ts`. Reasoning effort is set from the catalogue: off where a model doesn't need it, the lowest level where it is mandatory.
3. Sends the raw answers to the judge model (`JUDGE_MODEL`, default `anthropic/claude-opus-5.5`). The judge merges them into single-word canonical answers: same thing, same root (zákon, zákoník), inflections, typos; a list answer counts for its most common item. Every answer must be used exactly once, otherwise the judge is asked again.
4. Runs the quality gate: at least 80 answers, the top answer at 45 % or less, at least 8 answers with 2 or more votes, the board holding at least 50 % of answers, nothing offensive. A question that fails is marked `rejected`, and a reserve question (`questions/reserve-*.json`) is tried for that date instead.
5. Writes the answer key. The judge model lists, for each board answer, every word a player might type for it: forms, diminutives, slang, brands, examples, and umbrella words ("alkohol" → Pivo). No word may fit two answers, and the names of answers outside the board stay wrong. On top of that, the client forgives diacritics, i/y, w/v, doubled letters and small typos.
6. Writes `puzzles/YYYY-MM-DD.json` (the board, the long tail, who said what, cost) and `runs/YYYY-MM-DD--<question>.json` (every raw response, attempt, latency and cost, plus the judge's output).

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

## Admin and custom games

`/admin` asks for the password in `ADMIN_PASSWORD`. A successful login sets a signed, httpOnly, SameSite=Strict cookie for 7 days. Every admin server function checks that cookie. In the admin you can:

- type a question and ask the 100 AIs (about $0.10–0.20, 1–2 minutes, with live progress);
- get a playable `/vlastni/<id>` link, with the gate verdict and cost;
- copy links to your custom games or delete them;
- see today's run details and answers.

Custom games are written to `custom/<id>.json` (or `CUSTOM_GAMES_DIR`) at runtime, so the server needs a writable disk. They don't count towards stats or streaks.

## Deploy (Appwrite)

Live at https://ai100.appwrite.network. It runs in the Appwrite project *Playground* (`6adc843b0015374f957c`, org *Almost apps*, region fra), and `appwrite.config.json` points the CLI at it.

| Resource | ID | Notes |
| --- | --- | --- |
| Site | `ai100` | TanStack Start, SSR, `npm ci` and `npm run build`, output `./dist`. The per-request key is scoped to `files.*`, `execution.*` and `rows.read`. Secret variable `ADMIN_PASSWORD`. |
| Function | `custom-game` | Node 22, 900 s timeout, scopes `files.read` and `files.write`, no public execute. Secret variable `OPENROUTER_API_KEY`. Runs one custom game (the 100 calls plus the judge) and saves it to the bucket. |
| Function | `daily-puzzles` | Node 22, 900 s timeout, runs every hour (`0 * * * *`), scopes `rows.read` and `rows.write`. Secret variable `OPENROUTER_API_KEY`. Makes sure today and the next 3 days have a board. |
| Bucket | `custom-games` | One JSON file per custom game, server access only. |
| Table | `ai100` / `puzzles` | One row per generation attempt: `date`, `questionId`, `question`, `number`, `passed`, `gate` (JSON), `costUsd`, `puzzle` (the board as JSON when it passed). A passed row's ID is its date. Server access only. |

A Site request may run for at most 30 s, so the admin starts the Function asynchronously and polls the execution. Locally (no `x-appwrite-key` header) custom games run in-process and save to `custom/`.

```bash
# site: deploy exactly what is committed (never uploads .env)
git archive --format=tar HEAD | tar -x -C /tmp/ai100 && cd /tmp/ai100 \
  && appwrite sites create-deployment --site-id ai100 --code . --activate --config-file <repo>/appwrite.config.json

# functions: bundle, then deploy package.json + dist/main.js
npm run build:function   # custom-game
npm run build:daily      # daily-puzzles
appwrite functions create-deployment --function-id <id> --code <folder with package.json and dist/main.js> --entrypoint dist/main.js --activate
```

Daily boards come from two places. Boards made locally with `npm run pipeline` live in `puzzles/` and are bundled into the Site build. The hourly `daily-puzzles` function covers the rest: for today and the next 3 days without a bundled board or a passed row, it takes the question scheduled in `questions/`, runs the 100 answerers and the judge, and saves a row. If the board fails the quality gate it tries an unused reserve question, up to 3 attempts per day, and stops starting new attempts after 8 minutes so the next hourly run picks up the rest. Redeploy the function after changing `questions/`, since the bank is bundled into it. The local pipeline doesn't read the table, so use it for back-filling or redoing past days, not for days the function already covered. Run it by hand with `appwrite functions create-execution --function-id daily-puzzles --async`.

## Credits

Avatars: blobatar (MIT). Typeface: Bricolage Grotesque (OFL). Not affiliated with any TV show.
