# Testing Pillars Fuel

There are two layers:

1. **Automated tests.** Run these before every release. They take about 30 seconds and touch no real data.
2. **Phone checklist.** Run it after every backend redeploy, or any time something looks off. It takes about 10 minutes against your real sheets.

---

## 1. Automated tests (`tests/`)

These load the real `index.html` in a headless browser. It talks to the real `apps-script/Code.gs`, which runs on an in-memory copy of your sheets. They simulate:
- lost replies
- airplane mode and reconnect
- rejected items
- double saves

```
node tests/run.js
```

- `ALL PASSED` (exit 0) means the build is safe to push.
- Any `FAIL` (exit 1) means don't push.
- To test a different backend file: `GS=path/to/Code.gs node tests/run.js`

**What it checks:** retry duplicates, remove after a lost reply, a stuck queue, batch sync, the body-field clear, workout re-save, the Monsters # overwrite, untouched check-out fields, trashed Daily Plan docs, the startup sheet count, the date tap area, and the version label.

**To run it on your PC (one time):** install Node.js, then in the repo folder:

```
npm i playwright
npx playwright install chromium
```

**Limit:** this proves the logic, not your real sheets. Your real column layout, formulas and Google's quirks are covered by the phone checklist below.

---

## 2. Phone checklist (real sheets)

Use **today's date**. When you're done, delete the test rows (the last step covers this).

Where to look:
- **Food Log, Daily Body:** the *Carnivore Nutrition* sheet.
- **Workout Log, Sessions:** the *Strength Training* sheet.
- **Daily Log:** the *Pillars Tracker* sheet.

| # | Do this in the app | Then check | Pass if |
|---|---|---|---|
| 0 | Check-out → Settings | Bottom line | Shows the current version (e.g. **v6.1.2**) |
| 1 | Log **1 egg** | Food Log, newest row, column **AK** | Note looks like `@07:10 app #L…` |
| 2 | Airplane mode on. Log **3 eggs**, one tap each | Sync bar | Says **3 waiting** |
| 3 | Airplane mode off, wait 10 s | Food Log | Exactly **3 new rows**, each with its own `#L…`, none doubled |
| 4 | Today → tap one of the test eggs → Remove | Food Log | That row's A–D and AK are blank |
| 5 | Train → add any exercise, enter 2 rounds → **Save** | Workout Log | 2 rows, Notes (col **K**) end with `#W…` |
| 6 | Change one rep number → **Save** again (confirm says *Update*) | Workout Log, Sessions | Still **2 rows** (updated), Sessions minutes **not doubled** |
| 7 | Type **2** in Daily Log → *Monsters #* for today in the sheet. In the app, log **no** Monster → Check-out → Save | Daily Log → Monsters # | Still **2** |
| 8 | Body → type a test weight → Save | Daily Body, today, column **B** | Shows the test weight |
| 9 | Body → clear the weight box → Save | Daily Body, column **B** | Cell is **empty** |
| 10 | Body → change nothing → Save | App toast | Says **No changes** |
| 10b | Body → change steps → Save | Daily Body H2 | Still a working formula (no **#REF!**), today's H cell not typed in |
| 11 | Today → Daily Plan card | Card | Shows today's doc (not an old copy) |
| 12 | Edit any value on the Foods tab → Settings → **Refresh foods, targets & goals** | App | The new value appears |

**Clean up:**
- Clear the test egg rows (A–D and AK only; never delete row 2).
- Clear the test workout rows (A–K), and fix today's Sessions minutes.
- Restore Monsters # and the weight.

**If a step fails:** screenshot the app's sync bar and the sheet row, and note the step number.

---

## Log of test runs

| Date | Version | Automated | Phone checklist | Notes |
|---|---|---|---|---|
| 2026-11-03 | v6.1.2 | 18/18 pass | not run yet | |
| 2026-11-04 | v6.2 | 20/20 pass | not run yet | added caffeine/erythritol check |
| 2026-11-04 | v6.1.4 | 19/19 pass | **Steps 1–3 pass** (others not run yet) | Wi-Fi + cellular off, logged Monster Zero Ultra, waited, back online → synced. Food Log row 18 has exactly 1 entry with `#L1793793890447kbc3`. |
