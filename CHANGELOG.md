# Pillars Fuel: Version History

Newest first. Each version has a number and a short name.

## How the numbers work

| Part | Example | Goes up when |
|---|---|---|
| **Major** | v**6**.0 | A new tab, layout or feature area |
| **Minor** | v6.**1** | Upgrades or fixes to features that already exist |
| **Patch** | v6.0.**1** | A one-line fix or display tweak |

**Backend** in each heading says whether `Code.gs` changed:
- **Yes:** paste the new `apps-script/Code.gs` into Apps Script, then redeploy with **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL and token stay the same.
- **No:** the app updates on its own. Close and reopen it twice.

---

## Deploy & repo log

Backend deploys and repo housekeeping. The token and URL themselves are **never** written here.

| Date | Version | What happened | New token? | New /exec URL? | Repo copy |
|---|---|---|---|---|---|
| Nov 3 | v6.0 | First Code.gs + appsscript.json put in the repo root for documentation | – | – | `code.gs`, `appsscript.json` (816e6a7) |
| Nov 3 | v6.1 | Code.gs pasted + deployed; app Settings updated on phone + PC | Yes | Yes | `code.gs` updated (ff79c8b) |
| Nov 4 | v6.1.4 | Code.gs pasted; ran a function in the editor (made a new token); deployed; app Settings updated | Yes | Yes | `code.gs` updated (b560b5b) |

**Where the files live:**
- `apps-script/Code.gs` and `apps-script/appsscript.json` are the working copies. The tests run against these.
- `code.gs` and `appsscript.json` in the repo root are Fernando's copies of what's actually deployed in Google Apps Script.

**Next time (keeps the same URL and token, so nothing to change in the app):**
- **Same URL:** after pasting the new Code.gs, go to **Deploy → Manage deployments → pencil (Edit) → Version: New version → Deploy**. **New deployment** is what makes a new URL.
- **Same token:** only run `setToken()` when you *want* a new token (for example, if it leaked). Saving the code doesn't need it.
- **Old deployments:** each URL from a past **New deployment** stays live, running its old code with your current token. Archive them under **Manage deployments → select the old one → Archive**, so an old v6.1.3 copy can't write the Training column again.

## v6.2 "Fine Print" (Nov 4, 2026)
**Backend: Yes.** Paste the new Code.gs and redeploy with **Manage deployments → Edit → New version** (keeps the URL and token).

**New tracking: caffeine, erythritol, L-carnitine, lysine**
- **Foods tab, columns AM–AP** (per 100 g):
  - **Caffeine:** coffee 40 mg and Monster Lo-Carb 30 mg from USDA. Monster Zero Ultra 31.7 mg (150 mg/can) and Diet Dr Pepper 11.5 mg (41 mg/12 oz) from labels.
  - **Erythritol:** Monster Zero Ultra 0.42 g (2 g/can, label).
  - **L-carnitine:** midpoint of the cooked range on the Deep Dive tab. Monster contains some, but the label gives no amount, so it adds 0.
  - **Lysine:** USDA SR28 nutrient 505. Blank where USDA has no value: beef heart, marrow, bone broth, pork belly, Havarti, Greek yogurt, queso fresco.
- **Food Log, columns AL–AO:** per-entry formulas, same pattern as the other nutrients. They sit after the Note column, so nothing the app writes moved.
- **Daily Totals, columns AH–AK:** daily sums. The sheet now has history, e.g. Nov 3: 455 mg caffeine, 3 g erythritol, 370 mg L-carnitine, 9.9 g lysine.
- **App, Nutrients tab:** new **Caffeine, sweetener & amino acids** card.
  - **Caffeine** against the FDA's 400 mg/day (bar turns red when over).
  - **Lysine** against 30 mg per kg of body weight (WHO/FAO).
  - **Erythritol** and **L-carnitine** as amounts.
  - L-carnitine moved here from Beyond the label, so it's counted once, from the Foods tab.
- **App, Today:** a ☕ caffeine line appears in Fuel at a glance once you've had any.
- **App:** after an update, it reloads foods and targets from the sheet once on its own.

**Data fix:** the Monster Zero Ultra Foods row now matches the can label (10 kcal, 380 mg sodium, 4 g net carbs, B3/B5/B6/B12). It was an estimate before.

## v6.1.4 (Nov 4, 2026)
**Backend: Yes.** Paste the new Code.gs and redeploy.
- **Fixed #REF! in Daily Body column H.**
  - **Cause:** H2 holds a formula that pulls Training (min) from Strength → Sessions and fills the whole column on its own. The app's Body save wrote a `0` into H7, and the formula can't write over a filled cell, so the column broke.
  - **Backend:** never writes column H now, and the code comments mark C and H as never-write.
  - **App:** the Training (min) box on the Body tab is read-only and labeled "from Train tab". Your minutes still arrive through the Train tab → Strength sheet → the H2 formula.
- **Tests:** a new check fails if the app ever writes to a formula column (C or H) in Daily Body. There are now 19 checks.

## v6.1.3 (Nov 4, 2026)
**Backend: No.**
- **Last 7 Days:** today is left out of the average and the "days on target" count until the day is over, so the stats don't read like a bad week at 5 AM. Today's bar still shows. Past days you browse to count normally.
- **Daily Plan card:** hides the doc's "Data notes" housekeeping line. The doc itself is unchanged.

## v6.1.2 (Nov 3, 2026)
**Backend: No.**
- Added **TESTING.md** and automated tests in `tests/` (`node tests/run.js`), with 18 checks against the real Code.gs on a mock copy of the sheets. They pass on v6.1.2; the pre-v6.1 backend fails 8 of them.
- The version number now shows at the bottom of **Check-out → Settings** (for example, `Pillars Fuel v6.1.2 "Ironclad"`), with a **what's new** link to this file.

## v6.1.1 (Nov 3, 2026)
**Backend: No.**
- Repo renamed **Scout → Pillar-Fuel**. The app's address is now **https://cupyblon.github.io/Pillar-Fuel/**.
- Your settings and offline queue carry over, since both addresses are on the same site. But the old home-screen icon points to the old address, which stops working. Delete it and add the new address from Safari (**Share → Add to Home Screen**).

## v6.1 "Ironclad" (Nov 3, 2026)
**Backend: Yes.** This version came out of a full line-by-line code review. It targets bugs that could quietly put wrong data in your sheets.

**Data fixes**
- **No more duplicate food rows.** Each entry carries an app ID in the Food Log note (`@08:00 app #L…`). If the phone loses the server's reply and retries, the server sees the ID and skips the second copy.
- **Removing a food always works.** It removes by app ID, so it works even if the phone never learned the row number, including entries whose save reply was lost.
- **The offline queue can't get stuck.** A food the server rejects, such as a name that isn't on the Foods tab, is dropped and shown in the sync bar. Everything behind it keeps syncing. Network, token and "server busy" errors still wait and retry.
- **Re-saving a workout replaces it.** Each session gets an ID (`#W…` in Workout Log notes). Saving again overwrites that session's rows and minutes instead of adding new ones.
- **Check-out sends only what you touched.** Monsters # is never sent as 0, so it can't wipe a count from your daily doc or the Weekly Sync.
- **Body sends only changed fields.** Clearing a box (weight, steps, water…) now clears that cell in the sheet.
- **The Daily Plan card skips trashed docs.** If there are copies, it uses the newest one.

**Speed**
- **One request for up to 20 waiting changes.** A day of offline logging syncs in one round trip instead of one per item.
- **Faster startup.** The app no longer opens the Strength sheet at startup; it was loading the exercise list and never using it.
- **Sheet edits show up faster.** Edits to Foods, Targets and Goals appear within 1 hour instead of 6. There's also a new **Refresh foods, targets & goals** button in Check-out → Settings.

**iPhone**
- **The rest timer beeps and flashes green when rest ends.** The ring/silent switch still mutes the beep.
- **Classic layout:** tapping the date opens the iPhone's own date picker.
- **The home-screen icon and status bar use Dashboard navy** instead of the old brown.

**Cleanup:** unused code and a duplicated style rule removed. Offline cache bumped to `fuel-v10`.

**Known limit:** a workout saved before v6.1 has no session ID, so re-saving that one workout would still add rows. Workouts saved from v6.1 on are fine.

---

## v6.0.1 (Nov 3, 2026)
**Backend: No.**
- Stops Brave's iOS Night Mode from recoloring the Dashboard theme.

## v6.0 "Sun Field" (Nov 3, 2026)
**Backend: No.**
- New **Dashboard layout**, styled after the Sun Field app: navy theme, top icon tabs, a hero card, a "Fuel at a glance" card, a sticky date bar and a 1- to 3-column grid.
- Dashboard is the default. **▦** switches to Classic, and the app remembers your choice.
- Added the backend files (`apps-script/Code.gs`, `appsscript.json`) to the repo.

## v5.0 "Big Screen" (Nov 3, 2026)
**Backend: No.**
- **Desktop layout:** sidebar plus multi-column cards on a PC.
- **Auto / Desktop / Phone** toggle in the header.
- **Esc** closes pop-ups.

## v4.1 (Nov 3, 2026)
**Backend: No.**
- All six bottom-tab labels fit on an iPhone screen.

## v4.0 "Itinerary" (Nov 3, 2026)
**Backend: Yes.**
- **Daily Plan card** on Today, read from your "YYYY-MM-DD Daily Plan" docs. It has four tabs: Itinerary, Squeeze-ins, Walks/Weather and Journal (shows only the lines you filled in).
- Tap the date at the top to jump to any day.

## v3.2 "Beyond the Label" (Nov 3, 2026)
**Backend: Yes.**
- Nutrients tab gains a **Beyond the label** section, pulled from the Deep Dive tab: creatine, carnosine, taurine, carnitine, CoQ10, omega-3, CLA and vitamin K2.

## v3.1 (Nov 3, 2026)
**Backend: No.**
- Demo mode now has full USDA micronutrients for the 8 added foods.

## v3.0 "Iron" (Nov 2, 2026)
**Backend: Yes.**
- **Train tab:**
  - Workout types: single exercises, supersets and tri-sets.
  - Reps per exercise and a DB/BB switch.
  - Farmer's carry and the heavy-bag get-up, hoist, rotate, carry, slam move.
  - Rest timer and weekly sets per muscle group.
- Writes to the Strength Training sheet: Workout Log (one row per set) and Sessions (one row per day).

## v2.0 "Rings" (Nov 2, 2026)
**Backend: Yes.**
- Macro rings (protein, fat, carbs) and 7-day charts.
- **Nutrients tab:** the full vitamin and mineral list against your Targets tab.
- **Weight milestones** every 5 lb, with a weight chart and a 7-day average.
- The backend now sends all nutrients, targets and 30 days of history.

## v1.0 "First Bite" (Nov 2, 2026)
**Backend: Yes (first install).**
- iPhone logging app with quick food chips, a Check-out tab and an offline queue.
- Apps Script backend writes:
  - Food Log: columns A–D plus the note.
  - Daily Body.
  - The Daily Log check-out columns in the Pillars Tracker.
- Hosted on GitHub Pages; installable from Safari via **Share → Add to Home Screen**.
