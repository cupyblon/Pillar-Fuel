# Pillars Fuel

Personal carnivore food + daily check-out logger for iPhone. Tap-to-log foods, protein-first
dashboard, fasting window, weight trend, a morning journal, a workout logger with a full-screen
"round done" button and rest timer, a read-only Money tab (budget vs actual and bills), and an
evening check-out. It reads and writes Google Sheets through a private Google Apps Script endpoint.

- App: `index.html` (single file, installable from Safari via Add to Home Screen)
- Backend: `apps-script/Code.gs` (deploy as a web app, protected by a token)
- How it's all connected (shareable, with build-your-own steps): see `HOW-IT-WORKS.md`
- Setup: see `SETUP.md`
- **Beta (demo data only): https://cupyblon.github.io/Pillar-Fuel/beta/** — every app change lands here first; production changes only after "promote"
- Testing: see `TESTING.md` (three automated test files in `tests/` + a 10-minute phone checklist)
- Version history: see `CHANGELOG.md` (current: **v7.1.1**) · Live: https://cupyblon.github.io/Pillar-Fuel/

No data or credentials live in this repo. The script URL and token are stored only on the phone.
Without them the app runs in demo mode.

## Tabs
Today · Journal · Log · Nutrients · Train · Body · **Money** · Check-out

- **Train:** each exercise block has a **● Big button**. It turns the screen into one red DONE button, then a rest countdown with +30s, Pause and Skip rest. Rest actually taken is saved with each set.
- **Money (read-only):** income, spending vs plan, net cash flow, over-budget lines, bills with due dates, saved and invested. Month arrows change the month. It reads two more sheets (Budget 2026, Bill Tracker 2026) and never writes to them.

## Layouts
- **Dashboard** (default): Sun Field look. Navy + amber, icon tabs across the top, macro hero, "Fuel at a glance", date bar at the bottom.
- **Classic**: the original warm layout. Switch with the **▦** button in the header; the choice is remembered.
- **Auto / Desktop / Phone** (the pill next to ▦): Auto uses columns on screens 900 px and wider.
