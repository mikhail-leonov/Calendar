# The Event keeper

**Recurring Activity Manager** — a private, single-page app for tracking anything you do on a repeating schedule: cleaning the pool, replacing HVAC filters, servicing the car, paying a quarterly bill. Each activity has a frequency and a next-due date; as you complete occurrences they're written to a permanent history, and a unified timeline shows what's done, what's coming up, and what's overdue.

It runs entirely in the browser with no framework, no build step, and no backend — it even works straight from `file://`. Your data is stored locally and moved around with JSON export/import. The interface ships in English and Russian.

---

## Features

- **Two views**
  - **Timeline** — a single chronological ledger that merges completed history with projected upcoming occurrences, grouped by year, with a "Today" marker inserted where the timeline crosses today's date. Newest-first or oldest-first.
  - **Activities** — cards for every activity, sorted by status then next-due, each showing its frequency, next due date, completion count, and average delay.
- **Recurring schedules** — eight frequencies: daily, weekly, biweekly, monthly, quarterly, semiannual, annual, and a custom "every N days." Monthly-and-longer schedules are day-of-month anchored (e.g. the 31st rolls to the last day of shorter months).
- **Completion logging** — marking an activity done records the completion date and optional notes, computes how many days late it was, and advances the next-due date. Completed records are permanent: deleting an activity keeps its history in the timeline.
- **Skip** — advance past the current occurrence without recording a completion.
- **Statuses** — active, paused, completed, archived. Only active activities project upcoming occurrences.
- **Timeline controls** — search by name, filter by category, toggle Finished / Upcoming, and a "Today's events" view that shows everything due today plus anything overdue.
- **Categories** — free-form, with autocomplete seeded by a built-in list (Pool, Lawn & Garden, HVAC, Appliances, Vehicle, Financial, Health, Home Maintenance). Suggestions are hints only — never auto-added. The filter lists only categories actually in use.
- **Import & export** — export your whole register to a JSON file; import to restore (tolerant of older/aliased fields). "Clear all" wipes everything after a confirmation.
- **Localized interface** — switch language from the header; English and Russian included, with localized month and weekday names.

---

## Getting started

The app is fully static and has no module or backend dependencies, so you can simply open `index.html` in a browser — including directly from disk (`file://`). To serve it over HTTP instead:

```bash
# Python 3
python -m http.server 8000
# or Node
npx serve .
```

Click **New activity**, give it a name, category, frequency, and start date, and it appears on the timeline with its next-due date. As each occurrence comes up, use **✓ Done** to log it (or **Skip** to pass on it).

> Your data is saved in this browser's `localStorage`. **Clear all** removes it permanently, and persistence is best-effort — some browsers block `localStorage` on `file://`, in which case the app still runs but won't remember data between reloads. Use **Export** to keep a JSON backup either way.

---

## How the timeline is built

Finished entries come straight from the permanent completion history. Upcoming entries are *projected* from each active activity: the next due date is always shown (even if far off or overdue), and further occurrences are included only while they fall within a 90-day horizon, capped at four per activity so frequent tasks don't flood the view. Entries are sorted chronologically, finished items tie-breaking ahead of upcoming ones on the same day, and a "Today" rule is dropped in wherever the list crosses the current date — in either sort direction.

Dates are handled as plain `YYYY-MM-DD` at local midnight, so there are no timezone surprises.

---

## Activity fields

| Field | Description |
|-------|-------------|
| **Activity name** | What the recurring task is (e.g. "Clean the pool"). |
| **Category** | Free-form grouping with autocomplete. |
| **Status** | `active`, `paused`, `completed`, or `archived`. |
| **Frequency** | One of the eight options, including custom "every N days." |
| **Start date** | When the schedule begins. |
| **Next due** | Auto-computed from start + frequency (advanced to the first date on/after today), and overridable. |
| **Notes** | Optional free text. |

A completion record stores the **due date**, **completed date**, **delay in days**, and optional **notes**.

---

## Data & JSON format

State lives in `localStorage` under `keeper.state.v1` and has three parts: `activities`, `history`, and `categories`. The chosen language is stored under `keeper.lang`.

Export produces a file named `keeper-register-YYYY-MM-DD.json`:

```json
{
  "app": "The Keeper",
  "schema": 1,
  "exportedAt": "2026-06-20T12:00:00.000Z",
  "activities": [ /* … */ ],
  "history": [ /* … */ ],
  "categories": [ /* … */ ]
}
```

Import accepts this shape and normalizes each record, filling sensible defaults and tolerating older field names (e.g. `title` in place of `name`).

---

## Project structure

```
index.html                 App shell: header, tabs, toolbar, timeline/activities views, modals
public/
  css/
    app.css                Theme (parchment palette, Fraunces/Inter/IBM Plex Mono) — no CSS framework
  fonts/
    common/fraunces.css    Fraunces display font (degrades to system fonts offline)
  js/
    lng/
      en.js                English pack — self-registers into window.KeeperLang
      ru.js                Russian pack
    app.js                 Entire application (IIFE; constants, dates, state, projections, rendering, i18n)
```

`index.html` loads the language packs first, then `app.js`. Static text is marked with `data-i18n` (plus `data-i18n-ph` and `data-i18n-title` for placeholders and titles) and resolved against the active language pack. Dynamic content is localized through a `t(key, vars)` helper that interpolates `{placeholders}` and falls back to English, then to the key itself.

---

## Adding an interface language

1. Copy `public/js/lng/en.js` to `public/js/lng/<code>.js`.
2. Change the registration code (`K.register('<code>', { name:'…', dir:'ltr' }, { … })`) and translate the values, including the `months` and `weekdays` arrays.
3. Add a `<script src="public/js/lng/<code>.js">` tag in `index.html`, before `app.js`.

The new language appears in the header selector automatically; the app picks an initial language from your saved choice, then the browser language, then English.

---

## Browser support

Any current desktop or mobile browser with ES5+ and `localStorage`. The code is deliberately framework-free and dependency-free (Google Fonts degrade gracefully to system fonts when offline), and respects `prefers-reduced-motion`.

---

## Privacy

No server, no account, no cloud. Everything you enter stays in your own browser and is never uploaded. Use **Export** to back up your register as JSON and **Import** to restore it or move it to another machine.
