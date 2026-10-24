# Design and QA review: variant plan

Base: the commit that adds this file (`git rev-parse HEAD` in the main repo at /private/tmp/ptali-jsme-se-ai). Every variant is an independent patch against that base. Never combine variants in one patch.

## Output contract (per variant)

Write into `/private/tmp/ptali-jsme-se-ai/qa/review/<improvement-id>/<variant-id>/`:

- `patch.diff`: `git add -A && git diff --cached --binary <base>` taken in your worktree, including new files. Exclude `node_modules`, `.env`, `.taste-skill`, `qa/shots` and `qa/review`.
- Screenshots `desktop-<n>.jpg` and `phone-<n>.jpg` (1440×900 and 390×844), the same scenarios and the same order as `before/`.
- `meta.json`: `{ "title": "...", "summary": "1–2 sentences in English, what changes and how it looks", "tradeoffs": "1 sentence: risks or costs" }`.

Per improvement, also write `/private/tmp/ptali-jsme-se-ai/qa/review/<improvement-id>/before/` with the same scenarios captured on the unpatched base, and `/private/tmp/ptali-jsme-se-ai/qa/review/<improvement-id>/improvement.json`: `{ "title": "...", "problem": "2–3 sentences in English: what is wrong, seen in which screenshots", "category": "ux | design | marketing | bug | a11y" }`.

## How to work

1. `git worktree add /private/tmp/ai100-wt-<worker> <base>` (detached), then inside it `ln -s /private/tmp/ptali-jsme-se-ai/node_modules node_modules` and `ln -s /private/tmp/ptali-jsme-se-ai/.env .env` (never read or print .env).
2. Run the dev server from the worktree: `npx vite dev --port <your port>`, in the background. Restart it after applying or reverting a variant that adds or removes files or routes; otherwise HMR is enough. Wait for HTTP 200 before capturing.
3. Capture with `node qa/capture.mjs http://localhost:<port> <out-dir> <scenario-filter>`. The filter is a substring of scenario ids. You may add scenarios or actions to your worktree's copy of `qa/capture.mjs` (for example, a scenario that opens your dialog). Keep before and after identical, and copy the jpgs into the contract folder with the `desktop-n` and `phone-n` names (keep the scenario order).
4. Reset between variants: `git checkout -- . && git clean -fd -e node_modules -e .env`. Never commit, never push, never deploy, never touch the main repo's working tree outside `qa/review/<your ids>/`.
5. Each variant must pass `npx tsc --noEmit` and `npx eslint src` in your worktree before you take its patch. Match the code style (sparse comments, Czech UI copy with correct diacritics, the house rules of the taste skill: no gradients, no shadows at rest, no eyebrows, no monospace, square corners, Bricolage Grotesque, tokens from src/styles.css).
6. When done, remove your worktree (`git worktree remove --force`) and stop your dev server.

## Improvements

### onboarding (ux): first-visit "how to play"
First-time visitors see eight "?" keys with no explanation of clues, scoring or the one-word rule; the rules are at the bottom of the page. Scenarios: `home-fresh` (top shot only is enough) plus a scenario that shows the variant's open state if it has one.
- `dialog`: on the first visit a "Jak hrát" dialog (shadcn Dialog) with three short paragraphs (one word, the blue "?" for clues and its costs, five lives and scoring) and one primary "Hrát" button; dismissal stored in localStorage (`pjs100:navod`). A "Jak hrát" link in the header reopens it.
- `inline-strip`: a compact guide strip under the lead paragraph on the blue field: three short items set as flap-style tiles plus text ("Jedno slovo", "? = nápověda", "5 životů"), with a "Rozumím" button that hides it for good.
- `board-demo`: on the first visit, slot 1 of the board flips to an example ("PŘÍKLAD" / a sample answer and number) for ~2.5 s and flips back; then a small coach-mark bubble points at the "?" key: "Tady je nápověda". Shown once.
- `help-tile`: no first-visit interruption: a "Jak hrát?" tile next to the date strip (same tile style) that opens a popover with the rules summary.

### mobile-input (ux): typing on a phone
On a phone the input sits under an eight-row board, so the open keyboard hides the board and every guess means scrolling. Scenarios: `home-midgame` and `home-wrong-guess`, phone and desktop (desktop must stay unchanged or improve).
- `sticky-bar`: on phones a fixed bottom bar holds the input, "Tipnout", the five strike tiles and the score (safe-area aware); the page gets bottom padding so nothing is covered.
- `compact-board`: on phones, board rows shrink to ~36px, the lead paragraph collapses to one line, so the board and the input fit together above the keyboard.
- `input-first`: on phones, the input row (input, strikes, score) moves above the board, right under the date strip.

### mobile-nav (ux): navigation on phones
On phones the header only shows "Archiv"; Obsazení and Pravidla are reachable only from the footer. Scenarios: `home-fresh` and `archive`, phone (plus an open-state shot where relevant); desktop must stay unchanged.
- `menu-sheet`: a "Menu" button in the header opens a full-height sheet (Dialog) with large links: Dnešní hra, Archiv, Obsazení, Pravidla.
- `scroll-row`: a second header row on phones with all links in a horizontally scrolling row; the active one underlined.
- `bottom-tabs`: a fixed bottom tab bar on phones with four text tabs (Hra, Archiv, Obsazení, Pravidla); page padding added.

### tried-words (ux): remembering missed guesses
A missed guess only flashes a red X and a message; players forget what they already tried. Scenarios: `home-midgame` (two misses) desktop and phone.
- `chips`: under the input, "Zkoušeli jste:" followed by small chips of the missed words.
- `strike-labels`: each used strike tile shows the missed word under its X (tiles become wider labelled tiles).
- `board-row`: an extra full-width row at the bottom of the board, set in flap letters like a departure board: "MIMO TABULI · AUTO · MOBIL".

### game-over (ux): getting to the result
After the game ends, the result and the share buttons are one to two screens below; the hero only offers two anchor buttons. Scenarios: `home-lost` and `home-won` top shot, desktop and phone.
- `auto-scroll`: after the reveal animation (~1.8 s) the page scrolls smoothly to `#vysledek` (no scroll with reduced motion).
- `hero-summary`: the input row in the hero is replaced by a compact result: score flap, the eight result squares, a primary "Sdílet výsledek" button and a "Celý výsledek" link.
- `sticky-share`: after the game a sticky bottom bar ("483 bodů · Sdílet výsledek") stays visible until the share section scrolls into view.

### stats-empty (design): first-time statistics
A first-time visitor sees a statistics slip full of zeros and nine "0" histogram rows. Scenarios: `home-fresh` shot of `#dalsi-otazka` and `stats-history` (must stay unchanged), desktop and phone.
- `empty-note`: with zero games the slip shows only one friendly sentence and a link "Na dnešní tabuli" instead of the rows and the histogram.
- `ghost-histogram`: the rows stay, the histogram becomes pale placeholder bars with one sentence explaining what will appear.
- `invite-slip`: the slip is replaced by an invitation slip listing what will be tracked (série, průměr, celé tabule) in muted text, with a ticket-style "Začít" button that scrolls to the board.

### archive (design): the archive page
The archive is a bare table: date, question, score. It says nothing about how each day went. Scenarios: `archive` desktop and phone (with the mocked history).
- `result-squares`: keep the table, add a column with the eight mini result squares (from the saved game state `pjs100:hra:<date>`; empty squares when not played) and a "Hrát" button for unplayed days.
- `cards`: a list of paper slips, one per day: date tile (flap style), question, result line or "Nehráno", grouped under week headings.
- `calendar`: a month calendar grid; each day cell shows the date as a flap tile and is tinted by result (played, cleared, unplayed); click plays the day; the question shows under the grid for the hovered or selected day on phones.

### who-said (design): the 100-name wall
"Kdo co řekl" renders up to 100 chips in a row; on a phone it is several screens of chips. Scenarios: `home-lost` shot of `#kdo-co-rekl`, desktop and phone.
- `collapsed`: show the first 8 chips per answer and an "a dalších 21" button that expands.
- `faces`: avatar-only grid (blobatar faces ~40px) per answer; tapping a face opens the persona dialog; names appear on hover.
- `breakdown`: per answer a short demographic line plus a stacked bar of regions (Praha / Čechy / Morava) and age bands from the persona data, with a "Zobrazit všech 29" toggle for the chips.

### share-boost (marketing): sharing that brings people back
Shared links all show the same generic preview, the share text has no hook, and today's link is "/" (it shows a different question tomorrow). Scenarios: `home-lost` ticket shot desktop and phone, plus the captured share text in `meta.json` (add `"shareText"`), and for `og-image` a screenshot of the generated image.
- `streak-line`: share text and ticket gain the current streak ("Série 7 dní") and a playful title by score band (e.g. "Chatař roku" for a top score); link becomes `/hra/<date>`.
- `og-image`: a server route renders a per-question Open Graph image (question, date, the board look) and every puzzle page sets absolute `og:image`/`og:url` (site URL from `SITE_URL`, default `https://ai100.appwrite.network`); link becomes `/hra/<date>`. Use an off-the-shelf renderer (for example `satori` + `@resvg/resvg-js`) and mention the dependency in tradeoffs.
- `challenge`: share text and ticket reframed as a challenge: "Dáte víc než 483 bodů?" with the `/hra/<date>` link; the share button label becomes "Vyzvat kamarády".

### tap-targets (a11y): small tap targets on phones
On phones several targets are 19–26px tall: "Vzdát se a ukázat odpovědi", footer links, the names in "Mimo tabuli", "Odhlásit se". Scenarios: `home-fresh` footer shot and `home-lost` `#kdo-co-rekl` (Mimo tabuli part), phone (desktop unchanged).
- `padding`: invisible hit-area growth (padding plus negative margin) to at least 44px, no visual change.
- `buttons`: these links become real tone-step buttons at 44px.
- `restructure`: footer links as a two-column list of 48px rows; "Vzdát se" moves into a small "⋯" menu next to the score; Mimo tabuli names become chips.

## Fixes

### bad-dates (bug)
`/hra/nesmysl` says "Tahle otázka ještě nevyšla"; `/hra/2026-10-01` (before launch) says "Dnešní tabule ještě není hotová". Scenarios: `invalid-date`, `before-launch`, `future-date`, desktop and phone.
- `not-found`: invalid dates and dates before launch show the 404 page; a past date without a puzzle says "Pro tento den tabule není" with an archive link.
- `redirect`: invalid dates redirect to today's game; dates before launch redirect to the archive.

### admin-czech (bug)
In the admin, quality-gate flags are shown in English ("Neprošla: only 6 answers with 2+ votes (min 8)"). Scenario: `admin-dashboard`, desktop and phone.
- `translate`: translate the gate flags into Czech in the admin (map the structured gate values, do not string-match the English).

### share-link (bug)
Sharing from today's page links to "/", which shows a different question tomorrow. Scenario: `share-actions` (record the copied text in meta.json as `"shareText"`).
- `dated-link`: always share `/hra/<date>` for daily games.

### og-absolute (marketing)
`og:image` is the relative "/og.png", which many scrapers ignore. Scenario: none needed; put the rendered `<head>` meta lines in meta.json as `"head"`.
- `absolute`: absolute `og:image`, `og:url` and `twitter:image` from `SITE_URL` (default `https://ai100.appwrite.network`).

### popover-focus (design)
The hint menu opens with a blue outline around "Odkrýt písmeno" that reads as a selected state. Scenario: `home-hint-menu`, desktop and phone.
- `no-autofocus`: focus the menu container instead of the first option on open (keyboard users still Tab into it).
- `soft-focus`: keep autofocus but style focus inside the menu as a tone step instead of the outline.

## Worker assignment

| Worker | Port | Items |
| --- | --- | --- |
| 1 | 3101 | onboarding, mobile-input, mobile-nav |
| 2 | 3102 | tried-words, game-over, stats-empty |
| 3 | 3103 | archive, who-said, tap-targets |
| 4 | 3104 | share-boost, bad-dates, admin-czech, share-link, og-absolute, popover-focus |
