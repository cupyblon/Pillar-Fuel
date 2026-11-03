# Pillars Fuel

Personal carnivore food + daily check-out logger for iPhone. Tap-to-log foods, protein-first
dashboard, fasting window, weight trend, and an evening check-out that writes to Google Sheets
through a private Google Apps Script endpoint.

- App: `index.html` (single file, installable from Safari via Add to Home Screen)
- Backend: `apps-script/Code.gs` (deploy as a web app, protected by a token)
- Setup: see `SETUP.md`

No data or credentials live in this repo. The script URL and token are stored only on the phone.
Without them the app runs in demo mode.
