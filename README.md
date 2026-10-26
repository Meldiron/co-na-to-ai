# Co na to AI

Daily Czech guessing game in the spirit of Family Feud / *Co na to Češi*: „100 AI jsme se zeptali a teď hledáme osm nejčastějších odpovědí na otázku…“ Live at https://ai100.appwrite.network. Every day one survey question goes to 100 AI answerers (a different OpenRouter model per answerer, each playing a different Czech persona). Their answers are merged, and the player guesses the 8 most common. Five wrong guesses and the game is over.

Scoring: an answer is worth 10 points per AI that gave it, and clearing the board adds 200. Tapping a hidden answer offers two clues. "Odkrýt písmeno" reveals the next letter, up to 3, and never the whole word; each one takes a quarter of that answer's points, so a hinted answer is always worth more than a miss and less than finding it with fewer letters. "Kdo to řekl?" is free: it describes the personas who gave the answer ("hlavně důchodci z Moravy") and names the youngest and the oldest.

Stack: TanStack Start, React 19, Tailwind 4, shadcn/ui (radix). Node 22.18+ (the pipeline runs TypeScript directly with Node's type stripping).

## Run the game

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # matching, scoring, Prague day switch, stats, pipeline shapes
npm run build      # production build in dist/
```

Routes: `/` today's game, `/hra/YYYY-MM-DD` a past day, `/finale` this week's Finále (`/finale/<Monday>` for earlier weeks), `/archiv` the archive, `/dotazani` the 100 respondents (`/obsazeni` redirects there), `/vlastni/<id>` a custom game, `/admin` the admin for accounts with the `admin` label. `/sitemap.xml` lists the main pages and every published day, and `robots.txt` points to it.

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

For each date the pipeline does seven things:

1. Takes the question scheduled in `questions/YYYY-MM.json`.
2. Asks the 100 answerers in `data/answerers.json`. Each is a model + persona pair. The prompt is in Czech, temperature 0.9, and asks for a single word, not one repeated from the question, as structured JSON when the model supports it, plain text otherwise. The persona only lightly colours the answer. A failing model is retried, then replaced by a spare from `pipeline/lib/roster.ts`. Reasoning effort is set from the catalogue: off where a model doesn't need it, the lowest level where it is mandatory.
3. Sends the raw answers to the judge model (`JUDGE_MODEL`, default `anthropic/claude-opus-5.5`). The judge merges them into single-word canonical answers: same thing, same root (zákon, zákoník), inflections, typos; a list answer counts for its most common item. Every answer must be used exactly once, otherwise the judge is asked again.
4. Asks the judge model to review the merged answers against the question and drops the non-answers: an answer that repeats the question or names what it asks about ("Bunda" for "Jaký kabát nebo bundu nosíte v zimě?"), the category itself ("Oblečení" for "Co si vezmete na sebe do posilovny?") and catch-alls like "Věci". Those votes count as invalid, and the dropped words stay wrong for players.
5. Runs the quality gate: at least 80 answers, the top answer at 45 % or less, at least 8 answers with 2 or more votes, the board holding at least 50 % of answers, nothing offensive. A question that fails is marked `rejected`, and a reserve question (`questions/reserve-*.json`) is tried for that date instead.
6. Writes the answer key. The judge model lists, for each board answer, every word a player might type for it: forms, diminutives, slang, brands, examples, and umbrella words ("alkohol" → Pivo). No word may fit two answers, and the names of answers outside the board stay wrong. On top of that, the client forgives diacritics, i/y, w/v, doubled letters and small typos.
7. Writes `puzzles/YYYY-MM-DD.json` (the board, the long tail, who said what, cost) and `runs/YYYY-MM-DD--<question>.json` (every raw response, attempt, latency and cost, plus the judge's output).

Each run prints the top 8, the top share, the cost and any gate flags.

`.github/workflows/puzzles.yml` tops the queue up every night and commits the new files. It needs the `OPENROUTER_API_KEY` repository secret.

## Adding questions

Questions live in `questions/YYYY-MM.json`:

```json
{ "id": "chata", "date": "2026-10-24", "text": "Co si berete s sebou na chatu?", "tags": ["chata"], "status": "approved" }
```

`status` is `draft | approved | used | rejected`; the pipeline only uses `approved` ones. The bank is dated through 2027-10-31 and has 50 undated reserves. A good question has an open but finite answer space. Avoid one obvious answer ("Jmenujte ovoce" gives 70 % jablko) and avoid hundreds of equally likely ones. Keep it under 70 characters.

## The question bank

Questions come from `questions/` (dated through 2027-10-31, plus reserves) and from the `questions` table, which refills itself:

- **Probe.** Before the full run of 100, 15 answerers spread across the cast answer the question (`pipeline/probe.ts`, about $0.02). If one answer takes half of them, or the answers are nearly all different, the question is skipped and the next reserve is tried. That saves the full run and the judge on questions that would fail the gate anyway.
- **Refill.** Every night the `maintenance` function counts the reserves still waiting (unused bundled reserves, approved and unreviewed drafts). Below 30, the judge model drafts 20 new questions (`pipeline/bank.ts`), learning from recent boards that passed and failed, and drops anything too close to an existing question. Each draft is probed; the ones that pass wait for review, the rest are stored as rejected with the reason.
- **Review.** The admin's "Zásobník otázek" lists the drafts with the probe's answers. Approved drafts are used before unreviewed ones; unreviewed drafts are used only when everything else runs out, so a day never stays without a board. "Navrhnout nové otázky" runs a refill right away.

## The cast

`data/personas.json` holds 100 Czech personas. `pipeline/lib/roster.ts` lists 100 distinct models plus spares. `npm run cast` pairs them, deterministically, into `data/answerers.json`. Keep persona ids stable, because old puzzles refer to them.

## Accounts

Everyone plays as a guest first. The first move creates an Appwrite anonymous session on the server and stores its secret in an httpOnly cookie (`pjs100_session`) on the site's own domain; the browser never talks to Appwrite directly. A guest becomes a permanent account by adding an email and a password (Appwrite converts the anonymous user in place, so nothing moves). Signing in on another device moves that browser's guest games into the account.

Every move is saved to the `games` table. The server replays the guesses against the real board before saving, so found answers, strikes and the score can't be claimed without the guesses. A finished game is never overwritten, and an older state from another device never replaces a newer one. The browser keeps a copy in localStorage and uses it when the server can't be reached. Guest games that were played before accounts existed are uploaded once.

A forgotten password is reset by email: "Zapomněli jste heslo?" in the account dialog asks Appwrite to send a recovery link (in Czech) to `/obnova-hesla`, where the new password is set. The form never reveals whether an email has an account. Recovery links only go to hostnames registered as web platforms in the project (`ai100.appwrite.network` and `localhost`).

Players pick the name shown on the leaderboard (`players` table, also set as the Appwrite user name). After a game, "Jak hráli ostatní" shows how many players finished the board, the average, your rank and the top 10. The share ticket and text carry the rank too ("Lepší než 82 % hráčů", or "Nejlepší výsledek dne"). Once 3 players have finished, "Co na to lidé" puts the players' own top 8 next to the AI board: every board answer counts the players who found it, and a wrong guess counts once per player and shows only when at least 2 players typed it (`src/lib/people.ts`).

## Finále

Once a week there is a Finále, like the last round of the show: 5 questions and 30 seconds for all of them, one answer per question. An answer scores the votes of the board answer it matches, and 100 points wins. A week runs Monday to Sunday (Prague time), and its id is the Monday's date. The first Finále is the week of 5 October 2026. The server keeps the boards. It hands out one question at a time, records when the round started, and scores each answer as it arrives. When the 30 s run out, the answer being sent still counts if it arrives within 3 s, and every question not reached scores 0. Reloading doesn't reset the clock, and a round left open is closed the next time it's loaded. The leaderboard counts games finished within their week. Earlier weeks stay playable for practice. The archive lists each month's Finále weeks above the daily questions, with the player's result or a link to play.

The hourly `daily-puzzles` function keeps this week's and next week's Finále ready, after it has covered the days, and back-fills any older week since the launch that is still missing a question. It takes approved questions from the bank first, then newer candidates, then bundled reserves from the end of the list, so it doesn't compete with the daily boards for the same reserve. Each question is probed first: it is skipped when one answer has over 60 % or the answers are all over the place. Then it runs through the full pipeline, and the board is kept if at least 70 valid answers are left after the review and it has at least 5 answers. At most 8 failed questions are tried per week.

The streak counts days when the board was finished on the day it came out. Two streak freezes are always ready: up to two missed days in a row keep the streak alive (they don't add to it), and both refill after the next played day. The third missed day in a row ends the streak (`src/lib/streak.ts`).

Without `APPWRITE_SITE_API_ENDPOINT`, `APPWRITE_SITE_PROJECT_ID` and a key, accounts are switched off and the game keeps everything in the browser. To run accounts locally, start the dev server with a short-lived key:

```bash
APPWRITE_SITE_API_ENDPOINT=https://fra.cloud.appwrite.io/v1 APPWRITE_SITE_PROJECT_ID=6adc843b0015374f957c \
APPWRITE_API_KEY=$(appwrite project create-ephemeral-key --duration 3600 --show-secrets -j \
  --scopes sessions.write --scopes rows.read --scopes rows.write --scopes files.read --scopes files.write \
  --scopes execution.read --scopes execution.write | jq -r .secret) npm run dev
```

`node qa/accounts.mjs <url>` runs the whole account flow in a headless browser (it creates a real `qa-…@example.com` user).

## Admin and custom games

`/admin` is open to accounts with the Appwrite user label `admin` (`appwrite users update-labels --user-id <id> --labels admin`). Every admin server function checks the label. In the admin you can:

- type a question and ask the 100 AIs (about $0.10–0.20, 1–2 minutes, with live progress);
- get a playable `/vlastni/<id>` link, with the gate verdict and cost;
- copy links to your custom games or delete them;
- read the missed guesses of any day or custom game, grouped across spellings, to find synonyms the board should accept;
- review drafted questions in the question bank and run a refill;
- see today's run details and answers.

Custom games are written to `custom/<id>.json` (or `CUSTOM_GAMES_DIR`) at runtime, so the server needs a writable disk. They don't count towards stats or streaks.

## Deploy (Appwrite)

Live at https://ai100.appwrite.network. It runs in the Appwrite project *Playground* (`6adc843b0015374f957c`, org *Almost apps*, region fra), and `appwrite.config.json` points the CLI at it.

| Resource | ID | Notes |
| --- | --- | --- |
| Site | `ai100` | TanStack Start, SSR, `npm ci` and `npm run build`, output `./dist`. The per-request key is scoped to `sessions.write`, `rows.*`, `files.*` and `execution.*`. Secret variable `APPWRITE_API_KEY` (a stored key with the same scopes) wins over the per-request key when set; it was added on 2026-10-25, when Appwrite started rejecting the site's per-request keys. Delete it once those work again. |
| Function | `custom-game` | Node 22, 900 s timeout, scopes `files.read` and `files.write`, no public execute. Secret variable `OPENROUTER_API_KEY`. Runs one custom game (the 100 calls plus the judge) and saves it to the bucket. |
| Function | `daily-puzzles` | Node 22, 900 s timeout, runs every hour (`0 * * * *`), scopes `rows.read` and `rows.write`. Secret variable `OPENROUTER_API_KEY`. Makes sure today and the next 3 days have a board, and that this week and next week have a Finále. |
| Bucket | `custom-games` | One JSON file per custom game, server access only. |
| Function | `maintenance` | Node 22, 900 s timeout, runs every night (`30 3 * * *`), scopes `users.*` and `rows.*`. Secret variable `OPENROUTER_API_KEY`. Refills the question bank and deletes guest users with no games after 30 days. Body `{ "task": "all" \| "questions" \| "cleanup", "force": bool, "dryRun": bool, "olderThanDays": n }`. |
| Table | `ai100` / `questions` | Drafted questions: `text`, `status` (candidate, approved, used, rejected), `source`, the `probe` result as JSON, `note`, `usedOn`. Server access only. |
| Table | `ai100` / `games` | One row per player and game: the replayed state, score, found answers, strikes, missed guesses, whether it was finished on the day. Unique on `userId` + `key`. Server access only. |
| Table | `ai100` / `finales` | Finále questions: `week`, `slot` (0–4), `questionId`, `question`, `passed`, `board` (answers with votes and aliases, as JSON), `answered`, `costUsd`, `note`. A passed row's ID is `<week>-<slot>`. Server access only. |
| Table | `ai100` / `finale_games` | One row per player and week: current `slot`, `startedAt`, the scored `answers` as JSON, `score`, `status`, `onTime`, `finishedAt`. Unique on `userId` + `week`. Server access only. |
| Table | `ai100` / `players` | Leaderboard names, row ID = user ID. Server access only. |
| Table | `ai100` / `puzzles` | One row per generation attempt: `date`, `questionId`, `question`, `number`, `passed`, `gate` (JSON), `costUsd`, `puzzle` (the board as JSON when it passed). A passed row's ID is its date. Server access only. |

A Site request may run for at most 30 s, so the admin starts the Function asynchronously and polls the execution. Locally (no `x-appwrite-key` header) custom games run in-process and save to `custom/`.

```bash
# site: deploy exactly what is committed (never uploads .env)
git archive --format=tar HEAD | tar -x -C /tmp/ai100 && cd /tmp/ai100 \
  && appwrite sites create-deployment --site-id ai100 --code . --activate --config-file <repo>/appwrite.config.json

# functions: bundle, then deploy package.json + dist/main.js
npm run build:function   # custom-game
npm run build:daily      # daily-puzzles
npm run build:maintenance # maintenance
appwrite functions create-deployment --function-id <id> --code <folder with package.json and dist/main.js> --entrypoint dist/main.js --activate
```

Daily boards come from two places. Boards made locally with `npm run pipeline` live in `puzzles/` and are bundled into the Site build. The hourly `daily-puzzles` function covers the rest: for today and the next 3 days without a bundled board or a passed row, it takes the question scheduled in `questions/`, runs the 100 answerers and the judge, and saves a row. If the board fails the quality gate it tries an unused reserve question, up to 3 attempts per day, and stops starting new attempts after 8 minutes so the next hourly run picks up the rest. Redeploy the function after changing `questions/`, since the bank is bundled into it. The local pipeline doesn't read the table, so use it for back-filling or redoing past days, not for days the function already covered. Run it by hand with `appwrite functions create-execution --function-id daily-puzzles --async`.

## Credits

Avatars: blobatar (MIT). Typeface: Bricolage Grotesque (OFL). Not affiliated with any TV show.
