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
 *                                     + AK (Note: time + app id, "@18:44 app #L…" — the id stops retry duplicates).
 *    Columns E-AJ are ARRAYFORMULAs that do the math from the Foods tab.
 *  - Carnivore Nutrition > Daily Body: A, B, D-G. NEVER C or H: C2 (7-day avg) and H2
 *    (Training min, pulled from Strength > Sessions) are formulas that fill their whole column;
 *    typing into any cell below them breaks the column with #REF!.
 *  - Pillars Tracker > Daily Log    : check-out columns, matched by header name.
 *  READ ONLY: Daily folder "YYYY-MM-DD Daily Plan" docs (GET ?action=plan&date=...).
 *  - Strength Training > Workout Log: A-K, one row per set (L-N are formulas);
 *                                     Notes end with "#W…" so re-saving a workout replaces it.
 *  - Strength Training > Sessions   : A-D, one row per workout day (E-G are formulas).
 *
 * Every request must carry your secret token (set it once with setToken()).
 */

const NUTRITION_ID = '1mAkG128NSk-IzEJg-EZTNbNBz7YmmhnlBjJJAYMoyhA';
const TRACKER_ID   = '1f2wlJqIKezVA1OHgX1OyHAwTmrXsCE019LNKDu0UvuA';
const STRENGTH_ID  = '1LYztTug2l94R81f5B0mgak0F3pR9GkM-g1hyBuWETpo';
const DAILY_FOLDER = '1lsYXiGZG0OpRZyfS1sb3sc1o-vq12Lu9';   // "YYYY-MM-DD Daily Plan" docs
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

// Morning Journal label keywords (match against trimmed-uppercase paragraph text).
const JOURNAL_LABELS = {
  Q:        '16 QUESTIONS',
  GRATEFUL: 'GRATEFUL',
  REFLECT:  'REFLECT',
  TOBE:     'TO BE',
  TOHAVE:   'TO HAVE',
  PERSONAL: 'TOP 3 PERSONAL',
  WORK:     'TOP 3 WORK',
  HONEYDO:  'TOP 3 HONEY'
};

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
    if (p.action === 'plan') return readPlan_(date);
    if (p.action === 'sets') return readSets_(date);
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
        case 'addSets':      return addSets_(b);
        case 'saveJournal':  return saveJournal_(b);
        case 'exercises':    return { exercises: readExercises_() };
        case 'batch':        return { results: b.items.map(function (it) {
                               it.token = b.token; return dispatch_(it); }) };
        default: throw new Error('Unknown action');
      }
    } finally { lock.releaseLock(); }
  });
}

function dispatch_(b) {
  // One bad item returns its own error instead of failing the whole batch.
  try {
    if (b.action === 'addFood') return addFood_(b);
    if (b.action === 'removeFood') return removeFood_(b);
    if (b.action === 'saveBody') return saveBody_(b);
    if (b.action === 'saveCheckout') return saveCheckout_(b);
    if (b.action === 'addSets') return addSets_(b);
    if (b.action === 'saveJournal') return saveJournal_(b);
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
    deep: readDeepDive_(ss),
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
// Extra columns AM..AP (per 100 g): Caffeine mg, Erythritol g, L-Carnitine mg, Lysine mg.
const NKEYS = ['kcal','p','f','sat','mono','poly','chol','c','ca','fe','mg','ph','k','na','zn','cu','mn','se',
  'vc','b1','b2','b3','b5','b6','fol','cho','b12','va','ve','vd','vk'];
const NUTRIENT_HEADERS = ['Calories (kcal)','Protein (g)','Fat, total (g)','Saturated fat (g)','Monounsat. fat (g)',
  'Polyunsat. fat (g)','Cholesterol (mg)','Carbs (g)','Calcium (mg)','Iron (mg)','Magnesium (mg)','Phosphorus (mg)',
  'Potassium (mg)','Sodium (mg)','Zinc (mg)','Copper (mg)','Manganese (mg)','Selenium (mcg)','Vitamin C (mg)',
  'B1 Thiamin (mg)','B2 Riboflavin (mg)','B3 Niacin (mg)','B5 Pantothenic (mg)','B6 (mg)','Folate (mcg DFE)',
  'Choline (mg)','B12 (mcg)','Vitamin A (mcg RAE)','Vitamin E (mg)','Vitamin D (mcg)','Vitamin K (mcg)'];

function readFoods_(ss) {
  const sh = ss.getSheetByName('Foods');
  const cols = Math.min(42, sh.getLastColumn());   // A..AP when the extra columns exist
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues();
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
      x: [num_(r[38]), num_(r[39]), num_(r[40]), num_(r[41])],   // caffeine, erythritol, L-carnitine, lysine
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
    const id = note.match(/#(L[a-z0-9]+)/i);
    out.push({ row: i + 2, date: k, food: String(v[i][1]), amount: Number(v[i][2]),
               unit: String(v[i][3]), note: note, time: m ? m[1] : '', id: id ? id[1] : '' });
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
let FOOD_NAMES_ = null;   // memo for one request (a batch may add many foods)

// Row of the Food Log entry the app tagged "#<id>" in the note (0 if none).
// Only the last 500 rows are checked: a retry always lands near the bottom.
function findFoodId_(sh, id) {
  id = String(id || '').replace(/[^A-Za-z0-9]/g, '');
  if (!id) return 0;
  const last = lastDataRow_(sh);
  if (last < 2) return 0;
  const from = Math.max(2, last - 499);
  const notes = sh.getRange(from, NOTE_COL, last - from + 1, 1).getValues();
  const re = new RegExp('#' + id + '(?![A-Za-z0-9])');
  for (let i = notes.length - 1; i >= 0; i--) if (re.test(String(notes[i][0] || ''))) return from + i;
  return 0;
}

function addFood_(b) {
  const ss = SpreadsheetApp.openById(NUTRITION_ID);
  const sh = ss.getSheetByName('Food Log');
  // Retry safety: if this exact entry (same app id) is already in the log, don't add it again.
  const dup = findFoodId_(sh, b.id || b._local);
  if (dup) return { ok: true, row: dup, duplicate: true };
  if (!FOOD_NAMES_) FOOD_NAMES_ = readFoods_(ss).map(function (f) { return f.name; });
  if (FOOD_NAMES_.indexOf(b.food) < 0) throw new Error('Food not in Foods tab: ' + b.food);
  const unit = ['g', 'oz', 'lb', 'serving'].indexOf(b.unit) >= 0 ? b.unit : 'serving';
  const amt = Number(b.amount);
  if (!(amt > 0)) throw new Error('Amount must be > 0');
  let row = lastDataRow_(sh) + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  sh.getRange(row, 1, 1, 4).setValues([[dateObj_(b.date), b.food, amt, unit]]);
  sh.getRange(row, 1).setNumberFormat('yyyy-mm-dd');
  const id = b.id || b._local;
  const note = '@' + (b.time || nowTime_()) + ' app' + (id ? ' #' + id : '') + (b.note ? ' · ' + b.note : '');
  sh.getRange(row, NOTE_COL).setValue(note);
  return { ok: true, row: row };
}

function removeFood_(b) {
  const sh = SpreadsheetApp.openById(NUTRITION_ID).getSheetByName('Food Log');
  // Prefer the app id (works even if the phone never learned the row number).
  let r = Number(b.row) || 0;
  const byId = findFoodId_(sh, b.id);
  if (b.id) { if (!byId) return { ok: true, missing: true }; r = byId; }
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
    // C column is a BYROW formula in C2 — find the real last row by column A.
    r = lastDataRow_(sh, 1) + 1;
    sh.getRange(r, 1).setValue(dateObj_(b.date)).setNumberFormat('yyyy-mm-dd');
  }
  // Field not sent = leave it alone. Sent as '' = you cleared it, so clear the cell.
  const set = function (col, val) {
    if (val === undefined || val === null) return;
    if (val === '') sh.getRange(r, col).clearContent();
    else sh.getRange(r, col).setValue(val);
  };
  set(2, b.weight); set(4, b.steps); set(5, b.water);
  set(6, b.exercise); set(7, b.note);   // column H (training) is a formula: never written
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

// POST {action:'saveJournal', date, q?, g1?, g2?, g3?, well?, didnt?, tobe?, tohave?,
//       p1?, p2?, p3?, w1?, w2?, w3?, h1?, h2?, h3?}
// Only fields present (not undefined) are written. Idempotent — replaces, never appends.
// Writes to: (a) MORNING JOURNAL section of the date's Daily Plan doc,
//            (b) Daily Log columns Grateful / To Be / Have / Feel / Top 3 by header name.
// If the doc doesn't exist, writes the tracker only and returns a warning message.
function saveJournal_(b) {
  const msgs = [];
  const date = b.date || todayKey_();

  // ── 1. Daily Log (Pillars Tracker) ───────────────────────────────────────
  const sh   = SpreadsheetApp.openById(TRACKER_ID).getSheetByName('Daily Log');
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let r = findDateRow_(sh, date);
  if (!r) {
    r = lastDataRow_(sh, 1) + 1;
    sh.getRange(r, 1).setValue(dateObj_(date)).setNumberFormat('yyyy-mm-dd');
  }
  const setCol_ = function (header, val) {
    if (val === undefined || val === null || val === '') return;
    const i = head.indexOf(header);
    if (i >= 0) sh.getRange(r, i + 1).setValue(val);
    else msgs.push('Column "' + header + '" not found — skipped tracker write.');
  };

  const gParts = [b.g1, b.g2, b.g3].filter(Boolean);
  if (gParts.length) setCol_('Grateful', gParts.join('; '));

  const toParts = [];
  if (b.tobe)   toParts.push('TO BE: '       + b.tobe);
  if (b.tohave) toParts.push('TO HAVE/FEEL: ' + b.tohave);
  if (toParts.length) setCol_('To Be / Have / Feel', toParts.join('\n'));

  const pItems = [b.p1, b.p2, b.p3].filter(Boolean);
  const wItems = [b.w1, b.w2, b.w3].filter(Boolean);
  const hItems = [b.h1, b.h2, b.h3].filter(Boolean);
  const top3Parts = [];
  if (pItems.length) top3Parts.push(pItems.join(', '));
  if (wItems.length) top3Parts.push('Work: '     + wItems.join(', '));
  if (hItems.length) top3Parts.push('Honey-do: ' + hItems.join(', '));
  if (top3Parts.length) setCol_('Top 3', top3Parts.join(' | '));

  // ── 2. Daily Plan doc ─────────────────────────────────────────────────────
  const docRes = writeJournalToDoc_(b, date);
  if (docRes.msg)   msgs.push(docRes.msg);
  if (!docRes.found) msgs.push('No Daily Plan doc for ' + date + ' — tracker updated only.');

  // Bust the plan cache so the next GET re-reads the updated doc.
  if (docRes.found) {
    try { CacheService.getScriptCache().remove('plan_' + date); } catch (e) {}
  }

  return { ok: true, row: r, msgs: msgs };
}

// Open the date's Daily Plan doc and rewrite the MORNING JOURNAL section.
// Returns {found: bool, msg?: string}.
function writeJournalToDoc_(b, date) {
  const it = DriveApp.getFolderById(DAILY_FOLDER).getFilesByName(date + ' Daily Plan');
  let f = null;
  while (it.hasNext()) {
    const x = it.next();
    if (x.isTrashed()) continue;
    if (!f || x.getLastUpdated() > f.getLastUpdated()) f = x;
  }
  if (!f) return { found: false };

  const doc  = DocumentApp.openById(f.getId());
  const body = doc.getBody();
  const n    = body.getNumChildren();
  const P    = DocumentApp.ElementType.PARAGRAPH;
  const LI   = DocumentApp.ElementType.LIST_ITEM;
  const NH   = DocumentApp.ParagraphHeading.NORMAL;

  // Find boundaries: MORNING JOURNAL heading → DAILY LOG heading.
  let start = -1, end = n;
  for (let i = 0; i < n; i++) {
    const el = body.getChild(i);
    if (el.getType() !== P) continue;
    const para = el.asParagraph();
    if (para.getHeading() === NH) continue;
    const up = para.getText().trim().toUpperCase();
    if (up.indexOf('MORNING JOURNAL') >= 0 && start < 0) { start = i; continue; }
    if (start >= 0 && up.indexOf('DAILY LOG') >= 0) { end = i; break; }
  }
  if (start < 0) return { found: true, msg: 'MORNING JOURNAL heading not found in doc.' };

  // Walk section: track current label and item index within that label.
  let label = '', itemIdx = 0;

  for (let i = start + 1; i < end; i++) {
    const el   = body.getChild(i);
    const type = el.getType();
    if (type !== P && type !== LI) continue;

    const elem    = type === P ? el.asParagraph() : el.asListItem();
    const txt     = elem.getText();
    const trimmed = txt.trim();
    if (!trimmed) continue;   // empty separator

    // Label paragraphs are PARAGRAPH type with NORMAL heading.
    if (type === P) {
      if (elem.getHeading() !== NH) continue;
      const up = trimmed.toUpperCase();
      let matched = '';
      for (const k in JOURNAL_LABELS) {
        if (up.indexOf(JOURNAL_LABELS[k]) >= 0) { matched = k; break; }
      }
      if (matched) { label = matched; itemIdx = 0; }
      // Whether matched or not, it's a label/heading line — not an item.
      continue;
    }

    // LIST_ITEM (or non-label PARAGRAPH acting as an item).
    if (!label) continue;

    if (label === 'Q') {
      // Append "· picked Q{n}" to the first item line; never to the label itself.
      if (itemIdx === 0 && b.q !== undefined && b.q !== null && b.q !== '') {
        const base = txt.replace(/\s*·\s*picked\s+Q\d+.*$/i, '').trimEnd();
        elem.editAsText().setText(base + ' · picked Q' + b.q);
      }
      itemIdx++;

    } else if (label === 'GRATEFUL') {
      itemIdx++;
      const val = [b.g1, b.g2, b.g3][itemIdx - 1];
      if (val !== undefined && val !== null && val !== '') {
        elem.editAsText().setText(itemIdx + ') ' + val);
      }

    } else if (label === 'REFLECT') {
      if (/went\s+well/i.test(trimmed)) {
        if (b.well) elem.editAsText().setText('Went well: ' + b.well);
      } else if (/didn.?t/i.test(trimmed)) {
        if (b.didnt) elem.editAsText().setText("Didn't: " + b.didnt);
      }
      itemIdx++;

    } else if (label === 'TOBE') {
      if (itemIdx === 0 && b.tobe) {
        elem.editAsText().setText('Today I want to be: ' + b.tobe);
      }
      itemIdx++;

    } else if (label === 'TOHAVE') {
      if (itemIdx === 0 && b.tohave) {
        // Preserve the prefix "Today I want to:" (with or without space).
        elem.editAsText().setText('Today I want to: ' + b.tohave);
      }
      itemIdx++;

    } else if (label === 'PERSONAL') {
      itemIdx++;
      if (itemIdx <= 3) {
        const val = [b.p1, b.p2, b.p3][itemIdx - 1];
        if (val !== undefined && val !== null && val !== '') {
          elem.editAsText().setText(itemIdx + ') ' + val);
        }
      }

    } else if (label === 'WORK') {
      itemIdx++;
      if (itemIdx <= 3) {
        const val = [b.w1, b.w2, b.w3][itemIdx - 1];
        if (val !== undefined && val !== null && val !== '') {
          elem.editAsText().setText(itemIdx + ') ' + val);
        }
      }

    } else if (label === 'HONEYDO') {
      itemIdx++;
      if (itemIdx <= 3) {
        const val = [b.h1, b.h2, b.h3][itemIdx - 1];
        if (val !== undefined && val !== null && val !== '') {
          elem.editAsText().setText(itemIdx + ') ' + val);
        }
      }
    }
  }

  doc.saveAndClose();
  return { found: true };
}

// GET ?action=sets&date=YYYY-MM-DD  — read-only; returns that day's workout sets.
function readSets_(date) {
  const ss  = SpreadsheetApp.openById(STRENGTH_ID);
  const log = ss.getSheetByName('Workout Log');
  const last = log.getLastRow();
  if (last < 2) return { date: date, sets: [] };
  const rows = log.getRange(2, 1, last - 1, 11).getValues();
  const sets = [];
  rows.forEach(function (row) {
    if (!row[0] || key_(row[0]) !== date) return;
    sets.push({
      sessionType: row[1], exercise: row[2], set: row[3],
      reps: row[4], weight: row[5], time: row[6],
      distance: row[7], rest: row[8], effort: row[9], notes: row[10]
    });
  });
  return { date: date, sets: sets };
}

// Test from the editor: writes a sample journal to a TEST doc in the Daily folder.
// Paste the TEST doc ID below (must be a "YYYY-MM-DD Daily Plan" doc).
// SAFE: only writes to that one doc; never touches the real daily docs or sheets.
function testJournal() {
  const TEST_DATE = '2026-11-06';   // <-- set to a date that has a Daily Plan doc
  const b = {
    date: TEST_DATE,
    q: '5',
    g1: 'Good sleep', g2: 'Morning workout', g3: 'Quality time with family',
    well: 'Stayed on plan all day',
    didnt: 'Skipped the evening walk',
    tobe: 'present and focused',
    tohave: 'calm and clear-headed',
    p1: 'Finish the journal tab', p2: 'Read 20 min', p3: 'Call Dad',
    w1: 'Review quarterly goals', w2: 'Send the proposal', w3: 'Prep for standup',
    h1: 'Fix the leaky faucet', h2: 'Pay electric bill', h3: 'Oil change'
  };
  const docRes = writeJournalToDoc_(b, b.date);
  Logger.log('Doc result: ' + JSON.stringify(docRes));
  if (docRes.found) {
    // Print the URL so you can open it and verify.
    const it = DriveApp.getFolderById(DAILY_FOLDER).getFilesByName(b.date + ' Daily Plan');
    while (it.hasNext()) { const x = it.next(); if (!x.isTrashed()) Logger.log('Doc URL: ' + x.getUrl()); }
  }
  Logger.log('Done.');
}

// Deep Dive tab: row 3 = headers, rows 4+ = food | 9 compound columns (text, may be ranges).
function readDeepDive_(ss) {
  const sh = ss.getSheetByName('Deep Dive');
  if (!sh || sh.getLastRow() < 4) return [];
  const v = sh.getRange(4, 1, sh.getLastRow() - 3, 10).getDisplayValues();
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (!v[i][0]) break;                       // stop at the blank row above the legend
    out.push(v[i].map(String));
  }
  return out;
}

// Daily Plan doc for a date, exported as Markdown (read only). Cached 5 min.
function readPlan_(date) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('plan_' + date);
  if (hit) return JSON.parse(hit);
  const it = DriveApp.getFolderById(DAILY_FOLDER).getFilesByName(date + ' Daily Plan');
  let f = null;   // skip anything in the trash; if there are copies, use the newest
  while (it.hasNext()) {
    const x = it.next();
    if (x.isTrashed()) continue;
    if (!f || x.getLastUpdated() > f.getLastUpdated()) f = x;
  }
  if (!f) return { date: date, found: false };
  const get = function (mime) {
    return UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '/export?mimeType=' + encodeURIComponent(mime),
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  };
  let r = get('text/markdown');
  if (r.getResponseCode() !== 200) r = get('text/plain');
  const out = { date: date, found: true, url: f.getUrl(), updated: f.getLastUpdated().toISOString(),
                md: r.getResponseCode() === 200 ? r.getContentText() : '' };
  try { cache.put('plan_' + date, JSON.stringify(out), 300); } catch (e) {}   // skip cache if too big
  return out;
}

/* ---------- strength training ---------- */
function readExercises_() {
  const sh = SpreadsheetApp.openById(STRENGTH_ID).getSheetByName('Exercises');
  const v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 3).getValues();
  return v.filter(function (r) { return r[0] && r[1]; })
          .map(function (r) { return { name: String(r[0]), group: String(r[1]), equip: String(r[2]) }; });
}

// b.session (app id), b.sessionType, b.minutes,
// b.sets = [{exercise, set, reps, weight, time, distance, rest, effort, notes}]
// Saving the same session again REPLACES its rows (no duplicates).
function addSets_(b) {
  const ss = SpreadsheetApp.openById(STRENGTH_ID);
  const log = ss.getSheetByName('Workout Log');
  const sets = (b.sets || []).filter(function (x) { return x.exercise; });
  if (!sets.length) throw new Error('No sets');
  const sid = String(b.session || '').replace(/[^A-Za-z0-9]/g, '');
  const tag = sid ? '#' + sid : '';
  const blank = function (x) { return (x === undefined || x === null) ? '' : x; };
  const rows = sets.map(function (x) {
    const notes = [blank(x.notes), tag].filter(String).join(' ');
    return [dateObj_(b.date), b.sessionType || 'Weights', x.exercise, blank(x.set), blank(x.reps), blank(x.weight),
            blank(x.time), blank(x.distance), blank(x.rest), blank(x.effort), notes];
  });
  // Rows this session already wrote (found by the tag in Notes, column K).
  const last = lastDataRow_(log, 1);
  const old = [];
  if (tag && last >= 2) {
    log.getRange(2, 11, last - 1, 1).getValues().forEach(function (v, i) {
      if (String(v[0]).indexOf(tag) >= 0) old.push(i + 2);
    });
  }
  // Overwrite the old rows first, append whatever is left, clear old rows not needed.
  let i = 0;
  old.forEach(function (r) {
    if (i < rows.length) { log.getRange(r, 1, 1, 11).setValues([rows[i]]); log.getRange(r, 1).setNumberFormat('yyyy-mm-dd'); i++; }
    else log.getRange(r, 1, 1, 11).clearContent();
  });
  const rest = rows.slice(i);
  let r = last + 1;
  if (rest.length) {
    if (r + rest.length > log.getMaxRows()) log.insertRowsAfter(log.getMaxRows(), rest.length + 200);
    log.getRange(r, 1, rest.length, 11).setValues(rest);           // A-K only
    log.getRange(r, 1, rest.length, 1).setNumberFormat('yyyy-mm-dd');
  }
  // One Sessions row per date (A-D only). Minutes: add this session's change only.
  const props = PropertiesService.getScriptProperties();
  const mkey = sid ? 'min_' + sid : '';
  const before = mkey ? Number(props.getProperty(mkey)) || 0 : 0;
  const mins = Number(b.minutes) || 0;
  const ses = ss.getSheetByName('Sessions');
  let sr = findDateRow_(ses, b.date);
  if (!sr) {
    sr = lastDataRow_(ses, 1) + 1;
    ses.getRange(sr, 1, 1, 4).setValues([[dateObj_(b.date), b.sessionType || 'Weights', mins || '', 'Fuel app']]);
    ses.getRange(sr, 1).setNumberFormat('yyyy-mm-dd');
  } else if (mins !== before) {
    const c = ses.getRange(sr, 3);
    c.setValue(Math.max(0, (Number(c.getValue()) || 0) - before + mins));
  }
  if (mkey) props.setProperty(mkey, String(mins));
  return { ok: true, replaced: old.length, rows: rows.length };
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
