# Build Prompt — "The Keeper", a Recurring Activity Register

Build a single-page web app called **The Keeper** for tracking recurring household / maintenance activities (clean the pool, replace the AC filter, rotate tires, etc.). It is a *record manager*, not a calendar viewer: every activity is independent — there are no relationships, hierarchies, or family-tree structures.

Implement it exactly to the specification below.

---

## 1. Hard constraints (non-negotiable)

- **No backend, no server, no database, no cloud, no accounts, no Google/OAuth/Calendar integration.** Everything runs client-side.
- **Must run by opening `index.html` directly from `file://`** (double-click). Therefore:
  - **No ES modules.** Use plain `<script src="…">` tags only. (`type="module"` is blocked under `file://`.)
  - No bundler/build step. No frameworks (no React/Vue/Angular/jQuery/D3).
  - External resources are limited to **Google Fonts via `<link>`**, and these must **degrade gracefully to system fonts** when offline.
- **Vanilla ES5-compatible JavaScript** wrapped in an IIFE (`(function(){ 'use strict'; … })();`). No globals leak except the localization registry (see §10).
- **No default/sample data.** A fresh install opens **empty**, showing an empty-state prompt.
- All persistence is **best-effort `localStorage`** wrapped in `try/catch`; the canonical, portable store is **JSON export/import** (see §9).

## 2. File structure (exact)

```
index.html          ← markup only; links the css and scripts
css/app.css         ← all styles (no inline styles, no framework)
js/app.js           ← all application logic (one IIFE)
js/lng/en.js        ← English language pack (self-registers)
js/lng/ru.js        ← Russian language pack (self-registers)
```

`index.html` loads, in this order at end of `<body>`:
```html
<script src="js/lng/en.js"></script>
<script src="js/lng/ru.js"></script>
<script src="js/app.js"></script>
```
Language packs must load **before** `app.js`. Adding a new language must require only: drop a new `js/lng/xx.js` file and one `<script>` tag — no edits to `app.js`.

## 3. Design system (heritage / archival "ledger" aesthetic)

Warm cream paper look with a ruled-ledger timeline. Define these CSS variables on `:root`:

```
--paper:#f3eee2;  --surface:#fbf8f1;  --surface-2:#f7f1e4;
--ink:#2a2420;    --muted:#6f6557;    --faint:#9a8f7c;
--line:#d9cfba;   --line-soft:#e7ddca;
--accent:#6e2b26; --accent-soft:#8a3a33; --brass:#927339;
--sage:#5a6b4f;   --ochre:#b5852f;    --clay:#a8503c;  --slate:#4a5568;
--radius:10px;
--serif:"Fraunces",Georgia,serif;
--sans:"Inter",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
```

- Fonts from Google Fonts: **Fraunces** (display/headings), **Inter** (body/UI), **IBM Plex Mono** (IDs, dates, numeric data). Always provide the fallback stacks above.
- Body background `--paper` with a faint dotted "paper grain" via a fixed `body::before` radial-gradient overlay (low opacity, `pointer-events:none`).
- **Full-width layout**: the content wrapper uses `width:100%`, `max-width:none`, with ~28px side padding. (Do not center in a narrow column.)
- Sage = on-time/done, clay = late/overdue, slate = neutral upcoming, brass = accents/rules, accent (oxblood) = primary buttons.
- Accessibility: visible `:focus-visible` outline (use `--brass`), honor `prefers-reduced-motion`, responsive down to ~380px (stack rows/cards).

## 4. Data model

**Activity**
```
{ id, name, category, frequencyType, customDays,
  startDate, nextDueDate, notes, status, createdDate, updatedAt }
```
- `id`: short unique string. Display an "accession" code derived from it: `REG-XXXXXXXX` (uppercase alphanumerics, padded to 8).
- `frequencyType`: one of the keys in §5.
- `customDays`: integer ≥ 1 (used only when `frequencyType === 'custom'`).
- dates are `YYYY-MM-DD` strings; `status` ∈ {`active`,`paused`,`completed`,`archived`}.

**History record** (a permanent completion log; never auto-deleted)
```
{ id, activityId, activityName, category, dueDate, completedDate, delayDays, notes }
```
- `delayDays = completedDate − dueDate` in whole days (can be negative if done early).

App state shape (also the JSON export shape, see §9):
```
{ activities: [...], history: [...], categories: [...] }
```
- `categories` starts empty; user-created category names accumulate here. Built-in suggestions exist (Pool, Lawn & Garden, HVAC, Appliances, Vehicle, Financial, Health, Home Maintenance) but are offered **only as input hints** in the form's `<datalist>` — never auto-added to the register.

## 5. Recurrence engine

Frequencies (label, interval, unit):
```
daily(1 day), weekly(7 day), biweekly(14 day), monthly(1 month),
quarterly(3 month), semiannual(6 month), annual(12 month),
custom(every N days)
```

Date rules:
- Parse `YYYY-MM-DD` as **local midnight** (avoid UTC off-by-one).
- `advance(iso, activity)` returns the next due date one interval forward:
  - `custom` → add `customDays`.
  - day-unit → add `interval` days.
  - **month-unit → "anchored" month math**: remember the intended day-of-month from `startDate`, add the interval months, then clamp to `min(idealDay, lastDayOfTargetMonth)`. This must **recover** the original day after short months — e.g. a monthly task started Jan 31 yields `01-31 → 02-29 → 03-31 → 04-30`, not a drifting `02-29 → 03-29 → 04-29`.

**Upcoming projection** for the timeline (per active activity):
- Always include the **next due date** (even if far off or already overdue).
- Include further occurrences **only while they fall within a 90-day horizon** of today.
- Cap at **4 occurrences** per activity (so daily/weekly tasks don't flood the list, and semiannual/annual collapse to a single next date).

## 6. Layout & views

Header: circular crest "K", title "The Keeper", uppercase letter-spaced subtitle. Action buttons: **New activity** (primary), **Import JSON**, **Export JSON**, **Clear all** (danger/ghost), and a **language `<select>`**. Below the header, two tabs: **Timeline** (default) and **Activities**.

### 6a. Timeline (the unified chronological register)
- Merge **finished** entries (from history, dated by `completedDate`) and **upcoming** projected entries into one list.
- **Reversible chronological order.** Default **newest-first (descending)**; a toolbar toggle flips to oldest-first. Tie-break: finished before upcoming on the same date.
- Group by **year** with a ruled year header and a vertical **ledger rail** per year (left border with dots per entry).
- Insert a single **"Today · {date}"** divider where the list crosses today (placement adapts to sort direction).
- Each entry row shows: a colored dot (sage=finished, slate=upcoming, clay=overdue), a mono weekday+date column, the activity **name**, a status tag, a category chip, and — for finished — a "due {date}" chip and on-time/late delay (`+Nd`/`0d`). Optional note in italics.
- **Per-entry small buttons** (compact, on the right):
  - finished → **Edit** (jump to the activity), **✕** (remove that single history record).
  - upcoming, only on the actionable next occurrence → **✓ Done**, **Skip**, **Edit**.
- Empty register → friendly empty state with a "New activity" call to action.

### 6b. Activities (management)
- One card per activity, sorted by status (active→paused→completed→archived) then next due.
- Card shows accession `REG-…`, name, category, frequency label, **Next due {date}**, **{n} completed** with **avg +{n}d** delay, a status pill, and notes.
- Controls: **✓ Done** (active), **Pause**/**Resume**, **Edit**, **Delete**.

## 7. Toolbar (Timeline only)

- **Search** box: instant, client-side, matches activity name (case-insensitive).
- **Category filter** `<select>`: lists only categories actually present in the data (plus "All categories").
- **Finished** and **Upcoming** checkboxes (toggle which kinds show).
- **"Today's events"** toggle button: filters the timeline to entries **dated today PLUS every overdue item** (any active activity whose due date has passed and isn't done). Header reads "Today & overdue · {date} · {n}". Toggling switches to the Timeline tab, scrolls to top, and shows a toast with the count (or an "all caught up" empty state). Toggle again to restore the full timeline.
- **Direction toggle** button: "Newest first" ⇄ "Oldest first" (icon ↓/↑).

## 8. Interactions / CRUD

- **Add / Edit** via a modal form: name, category (with datalist hints), status, frequency (+ "every N days" field shown only for custom), start date, next due (auto-computed from start+frequency as first occurrence ≥ today, but user-overridable), notes. Save validates a non-empty name.
- **Complete** via a small modal: completed-on date (default today) + optional notes → pushes a permanent history record (`delayDays` computed) and **advances `nextDueDate`** one interval. Toast "next due {date}".
- **Skip**: advance `nextDueDate` one interval **without** recording a completion.
- **Delete activity**: confirm; removes the activity but **keeps its history records** in the timeline as a permanent record. (If a finished row's underlying activity is gone, "Edit" shows a toast instead of opening.)
- **Delete single record**: confirm; removes one history entry.
- **Clear all**: confirm (and suggest exporting first); wipe `activities`, `history`, `categories`, remove the `localStorage` key, reset filters, re-render. No-op toast if already empty.
- All mutations persist to `localStorage` and re-render. Use small transient **toasts** for feedback.

## 9. Persistence & JSON import/export

- `localStorage` key `keeper.state.v1` (schema `1`); all reads/writes wrapped in `try/catch` so a blocked `file://` storage never breaks the app.
- **Export**: build `{ app:"The Keeper", schema:1, exportedAt, activities, history, categories }`, `JSON.stringify(…, 2)`, download via `Blob` + `URL.createObjectURL` + a temporary `<a download>` named `keeper-register-{date}.json`. Must work from `file://`.
- **Import**: `<input type="file">` + `FileReader.readAsText`; parse, **normalize** each activity/history record (fill missing fields with safe defaults, validate `frequencyType`), replace state, persist, re-render. Toast counts on success; toast the error message on failure. Works from `file://`.

## 10. Localization architecture

A registerable, file-per-language system with zero `app.js` changes to add languages.

**Registry (created on first use by whichever pack loads first):**
```js
var K = (window.KeeperLang = window.KeeperLang || {
  dicts:{}, order:[],
  register:function(code, meta, dict){
    this.dicts[code] = { meta:meta, dict:dict };
    if(this.order.indexOf(code)===-1) this.order.push(code);
  }
});
K.register('en', { name:'English', dir:'ltr' }, { /* key: value … */ });
```

**Lookup in `app.js`:** `t(key, vars)` returns the current language's string, falling back to English, then to the key itself; interpolates `{placeholders}` from `vars`.

**Language selection:** on load pick saved language (`localStorage` key `keeper.lang`) → else the browser language if a pack exists → else English. A header `<select>` is auto-populated from the registry; changing it persists the choice and re-localizes everything live.

**Static DOM translation:** mark elements with `data-i18n="key"` (textContent), `data-i18n-ph="key"` (placeholder), `data-i18n-title="key"` (title). A single pass applies them; state-dependent toggle labels (Today/Overdue, sort direction) are set afterward.

**Localized dates:** each dictionary includes `months` (12) and `weekdays` (7) arrays; the date formatter and weekday helper read them, so dates render in the active language (e.g. `14 Jun 2026` ⇄ `14 июн 2026`).

**Coverage:** every visible string goes through `t()` — header, tabs, toolbar, modals, toasts, confirms, status pills, frequency labels, empty states, "today/overdue" header, etc. Ship **English** and **Russian** packs with **identical key sets** (full parity). Category names are user data and are intentionally **not** translated.

## 11. Acceptance checklist

- [ ] Opens from `file://` by double-clicking `index.html`; no modules, no backend, no console errors offline.
- [ ] Fresh load is empty (no sample data); empty state offers "New activity".
- [ ] Add/edit/complete/skip/delete activity and delete single record all work and persist across reload.
- [ ] Monthly-from-the-31st sequence recovers correctly (`01-31 → 02-29 → 03-31 → 04-30`).
- [ ] Timeline merges finished + upcoming, groups by year, shows a Today divider, and reverses via the toggle.
- [ ] Upcoming projection: next date always shown; further dates only within 90 days; max 4 per activity (no far-future clutter for semiannual/annual).
- [ ] "Today's events" shows items dated today **and** all overdue; excludes future-dated rows.
- [ ] JSON export downloads and re-imports cleanly from `file://`.
- [ ] "Clear all" wipes everything after confirmation.
- [ ] Language switcher flips the entire UI (including date month/weekday names) between English and Russian instantly and remembers the choice; adding a third language needs only a new `js/lng/xx.js` + one `<script>` tag.
- [ ] No inline styles; all CSS in `css/app.css`; all logic in one IIFE in `js/app.js`.
