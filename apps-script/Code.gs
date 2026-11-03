/**
 * Pillars Fuel — backend for the iPhone logging app.
 *
 * What this does (plain English):
 *  - The phone app calls this script's web URL.
 *  - GET  ?action=bootstrap&date=YYYY-MM-DD  -> sends back your foods, your
 *    targets (Goals tab), and everything already logged for that day.
 *  - POST {action: ...}                       -> writes what you tapped.
 *
 * What it writes (and ONLY these cells — your formulas stay untouched):
 *  - Carnivore Nutrition > Food Log : columns A-D (Date, Food, Amount, Unit)
 *                                     + AK (Note, holds the time "@18:44 app").
 *    Columns E-AJ are ARRAYFORMULAs that do the math from the Foods tab.
 *  - Carnivore Nutrition > Daily Body: A, B, D-H (C = 7-day avg is a formula).
 *  - Pillars Tracker > Daily Log    : check-out columns, matched by header name.
 *
 * Every request must carry your secret token (set it once with setToken()).
 */

const NUTRITION_ID = '1mAkG128NSk-IzEJg-EZTNbNBz7YmmhnlBjJJAYMoyhA';
const TRACKER_ID   = '1f2wlJqIKezVA1OHgX1OyHAwTmrXsCE019LNKDu0UvuA';
const TZ           = 'America/Chicago';
const NOTE_COL     = 37; // Food Log column AK

// Daily Log headers the app is allowed to write (must match row 1 exactly).
const CHECKOUT_FIELDS = [
  'Wins', 'Misses', 'Breakfast', 'Lunch', 'Dinner', 'Snacks / Drinks',
  'Monsters #', 'Exercise Types', 'Exercise Min', 'Sweat? (Y/N)',
  'Train Walk (steps or min)', 'Land Work', 'Screen Time (hrs)',
  'Family Time (min)', 'Family Activity', 'Dante Time? (Y/N)',
  'Meditated (min)', 'Water Before Bed? (Y/N)', 'Woke', 'Bed',
  'Family Note', 'Texted (Y/N, who)'
];
// Meal columns are only filled when empty, so the app never overwrites what
// you typed in a daily doc / what the Weekly Sync already wrote.
const FILL_ONLY_IF_EMPTY = ['Breakfast', 'Lunch', 'Dinner', 'Snacks / Drinks'];

/* ---------- one-time setup: run this from the editor ---------- */
function setToken() {
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  PropertiesService.getScriptProperties().setProperty('APP_TOKEN', token);
  Logger.log('Your app token (paste into the app Settings): ' + token);
}

/* ---------- web entry points ---------- */
function doGet(e) {
  return handle_(function () {
    const p = e.parameter || {};
    checkToken_(p.token);
    const date = p.date || todayKey_();
    if ((p.action || 'bootstrap') === 'bootstrap') return bootstrap_(date);
    if (p.action === 'day') return day_(date);
    throw new Error('Unknown action');
  });
}

function doPost(e) {
  return handle_(function () {
    const b = JSON.parse(e.postData.contents);
    checkToken_(b.token);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (b.action) {
        case 'addFood':      return addFood_(b);
        case 'removeFood':   return removeFood_(b);
        case 'saveBody':     return saveBody_(b);
        case 'saveCheckout': return saveCheckout_(b);
        case 'batch':        return { results: b.items.map(function (it) {
                               it.token = b.token; return dispatch_(it); }) };
        default: throw new Error('Unknown action');
      }
    } finally { lock.releaseLock(); }
  });
}

function dispatch_(b) {
  try {
    if (b.action === 'addFood') return addFood_(b);
    if (b.action === 'removeFood') return removeFood_(b);
    if (b.action === 'saveBody') return saveBody_(b);
    if (b.action === 'saveCheckout') return saveCheckout_(b);
    return { error: 'Unknown action' };
  } catch (err) { return { error: String(err.message || err) }; }
}

/* ---------- reads ---------- */
function bootstrap_(date) {
  const ss = SpreadsheetApp.openById(NUTRITION_ID);
  return {
    goals: readGoals_(ss),
    foods: readFoods_(ss),
    targets: readTargets_(ss),
    day: day_(date, ss)
  };
}

function day_(date, ss) {
  ss = ss || SpreadsheetApp.openById(NUTRITION_ID);
  const prev = shiftKey_(date, -1);
  const entries = readEntries_(ss, [date, prev]);
  return {
    date: date,
    entries: entries.filter(function (x) { return x.date === date; }),
    prevEntries: entries.filter(function (x) { return x.date === prev; }),
    prevLastTime: lastTime_(entries.filter(function (x) { return x.date === prev; })),
    body: readBody_(ss, date),
    checkout: readCheckout_(date),
    history: readHistory_(ss, date)
  };
}

// Daily Totals (formula tab): last 30 days of kcal / protein / fat / carbs.
function readHistory_(ss, date) {
  const sh = ss.getSheetByName('Daily Totals');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const from = shiftKey_(date, -30);
  const out = [];
  sh.getRange(2, 1, last - 1, 9).getValues().forEach(function (r) {
    if (!r[0]) return;
    const k = key_(r[0]);
    if (k < from || k > date) return;
    out.push({ date: k, k: num_(r[1]), p: num_(r[2]), f: num_(r[3]), c: num_(r[8]) });
  });
  out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

// Targets tab: daily target per nutrient (blank = no target).
function readTargets_(ss) {
  const sh = ss.getSheetByName('Targets');
  if (!sh) return {};
  const out = {};
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 3).getValues().forEach(function (r) {
    const i = NUTRIENT_HEADERS.indexOf(String(r[0]));
    if (i >= 0 && r[2] !== '' && !isNaN(Number(r[2]))) out[NKEYS[i]] = Number(r[2]);
  });
  return out;
}

function readGoals_(ss) {
  const v = ss.getSheetByName('Goals').getRange('A1:D16').getValues();
  const out = { phase: v[0][1] };
  const map = { 'Calories': 'kcal', 'Protein': 'protein', 'Fat': 'fat',
    'Net carbs (max)': 'carbs', 'Water': 'water', 'Steps': 'steps',
    'Exercise': 'exercise', 'Weight goal': 'weightGoal',
    'Starting weight': 'startWeight', 'Latest weight': 'latestWeight' };
  v.forEach(function (r) {
    const k = map[r[0]];
    if (!k) return;
    out[k] = Number(r[3] !== '' ? r[3] : r[1]);
    if (k === 'startWeight' || k === 'latestWeight') out[k] = Number(r[1]);
  });
  return out;
}

// Foods tab columns E..AI = 31 nutrients per 100 g, in NKEYS order.
const NKEYS = ['kcal','p','f','sat','mono','poly','chol','c','ca','fe','mg','ph','k','na','zn','cu','mn','se',
  'vc','b1','b2','b3','b5','b6','fol','cho','b12','va','ve','vd','vk'];
const NUTRIENT_HEADERS = ['Calories (kcal)','Protein (g)','Fat, total (g)','Saturated fat (g)','Monounsat. fat (g)',
  'Polyunsat. fat (g)','Cholesterol (mg)','Carbs (g)','Calcium (mg)','Iron (mg)','Magnesium (mg)','Phosphorus (mg)',
  'Potassium (mg)','Sodium (mg)','Zinc (mg)','Copper (mg)','Manganese (mg)','Selenium (mcg)','Vitamin C (mg)',
  'B1 Thiamin (mg)','B2 Riboflavin (mg)','B3 Niacin (mg)','B5 Pantothenic (mg)','B6 (mg)','Folate (mcg DFE)',
  'Choline (mg)','B12 (mcg)','Vitamin A (mcg RAE)','Vitamin E (mg)','Vitamin D (mcg)','Vitamin K (mcg)'];

function readFoods_(ss) {
  const sh = ss.getSheetByName('Foods');
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 35).getValues();
  const out = [];
  v.forEach(function (r) {
    if (!r[0] || r[3] === '' || isNaN(Number(r[3])) || Number(r[3]) <= 0) return;
    const n = [];
    let blanks = 0;
    for (let j = 4; j < 35; j++) { if (r[j] === '') blanks++; n.push(num_(r[j])); }
    out.push({
      name: String(r[0]), cat: String(r[1]), serving: String(r[2]),
      g: Number(r[3]),            // grams in one serving
      n: n,                       // 31 nutrients per 100 g (NKEYS order)
      sparse: blanks > 15,        // true = most micronutrients missing
      kcal: n[0], p: n[1], f: n[2], c: n[7]
    });
  });
  return out;
}

function readEntries_(ss, keys) {
  const sh = ss.getSheetByName('Food Log');
  const last = lastDataRow_(sh);
  if (last < 2) return [];
  const n = last - 1;
  const v = sh.getRange(2, 1, n, 4).getValues();
  const notes = sh.getRange(2, NOTE_COL, n, 1).getValues();
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!v[i][1]) continue;
    const k = key_(v[i][0]);
    if (keys.indexOf(k) < 0) continue;
    const note = String(notes[i][0] || '');
    const m = note.match(/@(\d{1,2}:\d{2})/);
    out.push({ row: i + 2, date: k, food: String(v[i][1]), amount: Number(v[i][2]),
               unit: String(v[i][3]), note: note, time: m ? m[1] : '' });
  }
  return out;
}

function lastTime_(list) {
  let best = '';
  list.forEach(function (x) { if (x.time && x.time > best) best = x.time; });
  return best;
}

function readBody_(ss, date) {
  const sh = ss.getSheetByName('Daily Body');
  const r = findDateRow_(sh, date);
  const hist = [];
  const last = sh.getLastRow();
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (x) {
      if (x[0] && x[1] !== '') hist.push({ date: key_(x[0]), w: Number(x[1]), avg: num_(x[2]) });
    });
  }
  hist.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  if (!r) return { hist: hist.slice(-60) };
  const x = sh.getRange(r, 1, 1, 8).getValues()[0];
  return { weight: x[1], avg: x[2], steps: x[3], water: x[4], exercise: x[5],
           note: x[6], training: x[7], hist: hist.slice(-60) };
}

function readCheckout_(date) {
  const sh = SpreadsheetApp.openById(TRACKER_ID).getSheetByName('Daily Log');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const r = findDateRow_(sh, date);
  const out = {};
  if (!r) return out;
  const row = sh.getRange(r, 1, 1, head.length).getDisplayValues()[0];
  CHECKOUT_FIELDS.forEach(function (h) {
    const i = head.indexOf(h);
    if (i >= 0) out[h] = row[i];
  });
  return out;
}

/* ---------- writes ---------- */
function addFood_(b) {
  const ss = SpreadsheetApp.openById(NUTRITION_ID);
  const foods = readFoods_(ss).map(function (f) { return f.name; });
  if (foods.indexOf(b.food) < 0) throw new Error('Food not in Foods tab: ' + b.food);
  const unit = ['g', 'oz', 'lb', 'serving'].indexOf(b.unit) >= 0 ? b.unit : 'serving';
  const amt = Number(b.amount);
  if (!(amt > 0)) throw new Error('Amount must be > 0');
  const sh = ss.getSheetByName('Food Log');
  let row = lastDataRow_(sh) + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  sh.getRange(row, 1, 1, 4).setValues([[dateObj_(b.date), b.food, amt, unit]]);
  sh.getRange(row, 1).setNumberFormat('yyyy-mm-dd');
  const note = '@' + (b.time || nowTime_()) + ' app' + (b.note ? ' · ' + b.note : '');
  sh.getRange(row, NOTE_COL).setValue(note);
  return { ok: true, row: row };
}

function removeFood_(b) {
  const sh = SpreadsheetApp.openById(NUTRITION_ID).getSheetByName('Food Log');
  const r = Number(b.row);
  if (r < 2) throw new Error('Bad row');
  const v = sh.getRange(r, 1, 1, 2).getValues()[0];
  // Safety: only clear the row if it is still the same food on the same date.
  if (String(v[1]) !== b.food || key_(v[0]) !== b.date) throw new Error('Row changed; refresh');
  // Clear input cells only (never delete the row: row 2 holds the formulas).
  sh.getRange(r, 1, 1, 4).clearContent();
  sh.getRange(r, NOTE_COL).clearContent();
  return { ok: true };
}

function saveBody_(b) {
  const sh = SpreadsheetApp.openById(NUTRITION_ID).getSheetByName('Daily Body');
  let r = findDateRow_(sh, b.date);
  if (!r) {
    r = Math.max(sh.getLastRow(), 1) + 1;
    // C column is a BYROW formula in C2 — find the real last row by column A.
    const a = sh.getRange('A:A').getValues();
    let last = 1;
    for (let i = a.length - 1; i >= 1; i--) if (a[i][0] !== '') { last = i + 1; break; }
    r = last + 1;
    sh.getRange(r, 1).setValue(dateObj_(b.date)).setNumberFormat('yyyy-mm-dd');
  }
  const set = function (col, val) {
    if (val === undefined || val === null || val === '') return;
    sh.getRange(r, col).setValue(val);
  };
  set(2, b.weight); set(4, b.steps); set(5, b.water);
  set(6, b.exercise); set(7, b.note); set(8, b.training);
  return { ok: true, row: r };
}

function saveCheckout_(b) {
  const sh = SpreadsheetApp.openById(TRACKER_ID).getSheetByName('Daily Log');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let r = findDateRow_(sh, b.date);
  if (!r) {
    r = lastDataRow_(sh, 1) + 1;
    sh.getRange(r, 1).setValue(dateObj_(b.date)).setNumberFormat('yyyy-mm-dd');
  }
  const written = [];
  Object.keys(b.fields || {}).forEach(function (h) {
    if (CHECKOUT_FIELDS.indexOf(h) < 0) return;
    const val = b.fields[h];
    if (val === undefined || val === null || val === '') return;
    const i = head.indexOf(h);
    if (i < 0) return;
    const cell = sh.getRange(r, i + 1);
    if (FILL_ONLY_IF_EMPTY.indexOf(h) >= 0 && cell.getValue() !== '') return;
    cell.setValue(val);
    written.push(h);
  });
  return { ok: true, row: r, written: written };
}

/* ---------- helpers ---------- */
function handle_(fn) {
  let out;
  try { out = fn(); } catch (err) { out = { error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
function checkToken_(t) {
  const real = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  if (!real) throw new Error('No token set. Run setToken() in the editor.');
  if (t !== real) throw new Error('Bad token');
}
function num_(x) { const n = Number(x); return isNaN(n) || x === '' ? 0 : n; }
function key_(d) {
  if (d instanceof Date) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return String(d).slice(0, 10);
}
function dateObj_(k) {
  const p = String(k).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function todayKey_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowTime_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm'); }
function shiftKey_(k, days) {
  const d = dateObj_(k); d.setDate(d.getDate() + days); return key_(d);
}
function findDateRow_(sh, k) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const v = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] !== '' && key_(v[i][0]) === k) return i + 2;
  return 0;
}
// Last row with something in column `col` (default B, the Food column).
function lastDataRow_(sh, col) {
  col = col || 2;
  const v = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] !== '') return i + 1;
  return 1;
}
