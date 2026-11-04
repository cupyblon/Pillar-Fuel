# Pillars Fuel

Personal carnivore food + daily check-out logger for iPhone. Tap-to-log foods, protein-first
dashboard, fasting window, weight trend, and an evening check-out that writes to Google Sheets
through a private Google Apps Script endpoint.

- App: `index.html` (single file, installable from Safari via Add to Home Screen)
- Backend: `apps-script/Code.gs` (deploy as a web app, protected by a token)
- How it's all connected (shareable, with build-your-own steps): see `HOW-IT-WORKS.md`
- Setup: see `SETUP.md`
- Testing: see `TESTING.md` (automated tests in `tests/` + a 10-minute phone checklist)
- Version history: see `CHANGELOG.md` (current: **v6.2.1**) · Live: https://cupyblon.github.io/Pillar-Fuel/

No data or credentials live in this repo. The script URL and token are stored only on the phone.
Without them the app runs in demo mode.

## Layouts
- **Dashboard** (default): Sun Field look. Navy + amber, icon tabs across the top, macro hero, "Fuel at a glance", date bar at the bottom.
- **Classic**: the original warm layout. Switch with the **▦** button in the header; the choice is remembered.
- **Auto / Desktop / Phone** (the pill next to ▦): Auto uses columns on screens 900 px and wider.
