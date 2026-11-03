# Pillars Fuel: setup (about 15 minutes)

Phone app (GitHub Pages) → Apps Script web URL → your Google Sheets.

## Step 1: Add 8 foods to the Foods tab (I can do this once you say go)

The Food Log math is an ARRAYFORMULA that looks foods up by name, so every quick chip
needs a row in **Carnivore Nutrition > Foods**. Rows go above the notes at the bottom.
Values are per 100 g, same as every other row.

| Food (exact name) | Category | Serving | Serving (g) | kcal | Protein | Fat | Carbs | Sodium (mg) | Note |
|---|---|---|---|---|---|---|---|---|---|
| Ground brisket burger (raw weight) | Beef | 4 oz raw | 113.4 | 254 | 17.17 | 20 | 0 | 66 | USDA 80/20 raw (23572); log RAW weight. Pkg label ≈1,141 kcal/lb |
| Black coffee, brewed | Drinks | 8 fl oz | 237 | 1 | 0.12 | 0.02 | 0 | 2 | USDA 14209 |
| Monster Zero Ultra | Drinks | 1 can (16 oz) | 473 | 2.8 | 0 | 0 | 1.13 | 42 | From label; verify can |
| T-bone steak, cooked | Beef | 3 oz cooked | 85 | 274 | 22.84 | 19.48 | 0 | 62 | Approx. USDA broiled, lean+fat |
| Top sirloin steak, cooked | Beef | 3 oz cooked | 85 | 234 | 27.3 | 13 | 0 | 58 | Approx.; check label |
| Queso fresco | Dairy | 1 oz | 28.35 | 299 | 18.09 | 23.82 | 2.98 | 751 | USDA 01250 (Mexican soft cheese) |
| Whole milk | Dairy | 1 cup | 244 | 61 | 3.15 | 3.25 | 4.8 | 43 | USDA 01077, 3.25% |
| Diet Dr Pepper | Drinks | 1 can (12 oz) | 355 | 0 | 0 | 0 | 0 | 15 | Label |

Until a row exists, its chip shows "not in sheet" and won't log.

## Step 2: Create the Apps Script (5 min)

1. Go to <https://script.google.com> → **New project**. Name it `Pillars Fuel`.
2. Delete everything in `Code.gs`, paste the whole `apps-script/Code.gs` file.
3. Gear icon (Project Settings) → check **Show "appsscript.json"**. Open it, replace with `apps-script/appsscript.json`.
4. Function dropdown → pick `setToken` → **Run**. Approve the Google permission screen
   (it's your own script; "Advanced → Go to Pillars Fuel"). Open **Execution log** and copy the token.
5. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
   Copy the **Web app URL** (ends in `/exec`).

"Anyone" means anyone with the URL *and* the token. Without the token every call returns "Bad token".

## Step 3: Put the app on GitHub Pages (5 min, same as Sun Field)

1. Repo: `cupyblon/Scout` (already created and pushed; public is fine:
   no data or token lives in the code).
2. Settings → Pages → Deploy from branch `main`, folder `/root`.
3. On the iPhone: open `https://cupyblon.github.io/Scout/` in **Safari** → Share → **Add to Home Screen**.
4. Open Fuel from the home screen → Check-out tab → Settings → paste URL + token → **Save & connect**.

## What the app writes (and what it never touches)

| Sheet > tab | Writes | Never touches |
|---|---|---|
| Carnivore Nutrition > Food Log | A Date, B Food, C Amount, D Unit, AK Note (`@18:44 app`) | E–AJ (formulas) |
| Carnivore Nutrition > Daily Body | A Date, B Weight, D Steps, E Water, F Exercise, G Note, H Training | C (7-day avg formula) |
| Pillars Tracker > Daily Log | Check-out columns by header name. Breakfast/Lunch/Dinner/Snacks only if empty | Grateful, To Be/Have/Feel, Top 3, Source Doc |

Removing an entry clears that row's A–D + AK; it never deletes rows (row 2 holds the formulas).

## Known conflict to fix before going live

The **Pillars Weekly Sync** (Sunday 9:20 PM) also writes Daily Log, Food Log and Daily Body
from your daily docs. If you log in the app *and* type meals in the daily doc, Sunday's sync can
double-count food. Pick one: (a) app is the source for food/body, sync skips dates the app already
filled, or (b) keep the daily doc for journaling only. I'd update the sync prompt for (a), with your OK.
