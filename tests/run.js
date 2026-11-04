// Pillars Fuel end-to-end test: the real index.html in a headless browser,
// talking to the real apps-script/Code.gs running on an in-memory copy of the sheets.
// Run:  node tests/run.js        (exit code 1 if anything fails)
const {chromium}=require('playwright'); const {makeEnv}=require('./mock-gas.js'); const path=require('path');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const APP='file://'+path.join(__dirname,'..','index.html');
(async()=>{
  const env=makeEnv(); const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844}});
  pg.on('dialog',d=>d.accept()); pg.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  let posts=[], loseNext=false, offline=false;
  await pg.route('https://fake.example/**', async route=>{ const r=route.request();
    if(offline) return route.abort();
    if(r.method()==='POST'){ const body=r.postData(); const j=JSON.parse(body); posts.push(j.action+(j.items?'('+j.items.map(i=>i.action).join(',')+')':''));
      const out=env.post(body); if(loseNext){ loseNext=false; return route.abort(); }
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)}); }
    const q=Object.fromEntries(new URL(r.url()).searchParams); return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(env.get(q))}); });
  await pg.goto(APP);
  await pg.evaluate("localStorage.setItem('fuel.cfg',JSON.stringify({url:'https://fake.example/exec',token:'t'}));localStorage.setItem('fuel.dash','false')");
  await pg.reload(); await pg.waitForTimeout(700);
  await pg.evaluate("state.date='2026-11-03'; load()"); await pg.waitForTimeout(500);
  const foodRows=()=>env.nut['Food Log'].d.slice(1).filter(r=>r[1]).length;
  // 1 lost reply then retry
  loseNext=true; await pg.evaluate("addEntry('Egg, whole (chicken)',4,'serving','08:00')"); await pg.waitForTimeout(400);
  await pg.evaluate("flush()"); await pg.waitForTimeout(400);
  ok(foodRows()===1, '1) lost reply + retry -> Food Log rows = '+foodRows()+' (want 1)');
  ok(/#L/.test(env.nut['Food Log'].d[1][36]), '   note has app id: '+env.nut['Food Log'].d[1][36]);
  // 2 rejected item does not block; batch = one request
  posts=[]; offline=true;
  await pg.evaluate("queue.push({action:'addFood',date:'2026-11-03',food:'Nope',amount:1,unit:'serving',time:'09:00',_local:'Lbad'}); LS.set('fuel.queue',queue)");
  await pg.evaluate("addEntry('Beef, ribeye',1,'serving','12:00'); addEntry('Beef, ribeye',1,'serving','18:00')");
  await pg.evaluate("show('body')"); await pg.fill('#bWater','80'); await pg.evaluate("$('#saveBody').click()"); await pg.waitForTimeout(300);
  offline=false; await pg.evaluate("flush()"); await pg.waitForTimeout(600);
  ok(posts.length===1, '2) 4 waiting changes sent in '+posts.length+' request: '+posts.join(' '));
  ok(await pg.evaluate("queue.length")===0, '   queue empty after a rejected item');
  ok(env.nut['Daily Body'].d[1][4]===80, '   water saved behind the bad item = '+env.nut['Daily Body'].d[1][4]);
  ok(env.nut['Daily Body'].d[1][3]===8000, '   steps untouched (not re-sent) = '+env.nut['Daily Body'].d[1][3]);
  console.log('   sync text:', await pg.textContent('#sync'));
  // 7 clear weight
  await pg.fill('#bWeight',''); await pg.evaluate("$('#saveBody').click()"); await pg.waitForTimeout(500);
  ok(env.nut['Daily Body'].d[1][1]==='', '7) cleared weight -> cell = "'+env.nut['Daily Body'].d[1][1]+'"');
  // 1b remove an entry whose add reply was lost (server has it, phone thinks local)
  const before=foodRows(); loseNext=true; await pg.evaluate("addEntry('Egg, whole (chicken)',2,'serving','20:00')"); await pg.waitForTimeout(400);
  await pg.evaluate("removeEntry(state.day.entries.find(e=>e.time==='20:00'))"); await pg.waitForTimeout(600);
  ok(foodRows()===before, '1b) remove after lost reply -> rows '+foodRows()+' (want '+before+')');
  // 3 workout saved twice with an edit
  await pg.evaluate("show('train'); addBlock(['Curl']); tr.blocks[0].rounds[0][0]={reps:12,w:30}; tr.blocks[0].rounds.push([{reps:10,w:30}]); tr.start=Date.now()-20*60000; trSaveLS()");
  await pg.click('#trSave'); await pg.waitForTimeout(500);
  await pg.evaluate("tr.blocks[0].rounds[1][0]={reps:8,w:35}; trSaveLS()"); await pg.click('#trSave'); await pg.waitForTimeout(500);
  const wl=env.str['Workout Log'].d.slice(1).filter(r=>r[2]); const ses=env.str['Sessions'].d.slice(1);
  ok(wl.length===2, '3) workout saved twice -> Workout Log rows = '+wl.length+' (want 2); set 2 = '+wl[1]?.[4]+'x'+wl[1]?.[5]);
  ok(ses.length===1&&ses[0][2]===20, '   Sessions minutes = '+ses[0]?.[2]+' (want 20, not 40)');
  // 4 check-out: monsters 0 must not wipe 2; untouched Woke stays
  await pg.evaluate("show('out'); renderOut()"); await pg.evaluate("$('#saveOut').click()"); await pg.waitForTimeout(500);
  const dl=env.trk['Daily Log'].d[1];
  ok(dl[7]===2, '4) Monsters # stays '+dl[7]+' (want 2)'); ok(dl[11]==='6:00 AM', '   Woke untouched = '+dl[11]);
  ok(/egg/i.test(dl[3]), '   Breakfast auto-filled: '+dl[3]);
  // 6 plan skips trashed
  const p=env.get({token:'t',action:'plan',date:'2026-11-03'}); ok(/GOOD/.test(p.md), '6) plan doc used: '+p.md);
  // 8 bootstrap no longer opens Strength sheet
  env.opens.n=0; const bs=env.get({token:'t',action:'bootstrap',date:'2026-11-03'}); ok(!('exercises' in bs), '8) bootstrap has no exercises; spreadsheets opened = '+env.opens.n);
  // 11 classic date picker covers the title
  await pg.evaluate("show('today')"); const w=await pg.evaluate("$('#datePick').getBoundingClientRect().width"); ok(w>50, '11) classic date tap area width = '+Math.round(w));
  // version shown
  ok(/v\d+\.\d+/.test(await pg.textContent('#verNote')), '   version in Settings: '+(await pg.textContent('#verNote')).trim());
  await b.close();
  console.log(fails?`\n${fails} FAILED`:'\nALL PASSED'); process.exit(fails?1:0);
})();
