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
  // formula columns never written (Daily Body C and H)
  await pg.evaluate("show('body')"); await pg.evaluate("state.day.body.training=0; render()"); await pg.fill('#bSteps','9000'); await pg.evaluate("$('#saveBody').click()"); await pg.waitForTimeout(500);
  // Server must ignore training even if an old app copy sends it.
  env.post(JSON.stringify({token:'t',action:'saveBody',date:'2026-11-03',training:0,exercise:15}));
  const bad=env.nut['Daily Body'].badWrites||[]; ok(!bad.length, 'F) no writes to formula columns C/H in Daily Body'+(bad.length?': '+bad.join(', '):''));
  // X) caffeine / erythritol from Foods AM..AP reach the app
  await pg.evaluate("show('today'); addEntry('Monster Energy Zero Ultra',1,'serving','07:00')"); await pg.waitForTimeout(300);
  const caf=await pg.evaluate("Math.round(state.T.caf)"), ery=await pg.evaluate("Math.round(state.T.ery*100)/100");
  ok(caf===150&&ery===1.99, 'X) 1 Monster -> caffeine '+caf+' mg (want 150), erythritol '+ery+' g (want 1.99)');
  // D) 🚗 drive day: train/walk items swapped for drive times; workout moves to evening; check-out marked Drove
  await pg.evaluate("plan={found:true,md:DEMO_PLAN_MD,url:''}; planTab='it'; LS.set('fuel.drive.'+state.date,false); $('#driveBtn').click()");
  const it=await pg.textContent('#planBody');
  ok(!/Walk 1|on the train|4:45 AM/.test(it)&&/Leave by car/.test(it)&&/7:30–7:45 PM: Workout/.test(it)&&/hands-free/.test(it), 'D) drive day itinerary: no train/walks/4:45, has drive + evening workout');
  const dr=await pg.evaluate("LS.get('fuel.outDraft.'+state.date,{})['Train Walk (steps or min)']"); ok(dr==='Drove', '   check-out Train Walk = '+dr);
  await pg.evaluate("$('#driveBtn').click()"); const back=await pg.textContent('#planBody');
  ok(/Walk 1/.test(back)&&!await pg.evaluate("LS.get('fuel.outDraft.'+state.date,{})['Train Walk (steps or min)']"), '   tap again: train plan back, Drove cleared');
  // 11 classic date picker covers the title
  await pg.evaluate("show('today')"); const w=await pg.evaluate("$('#datePick').getBoundingClientRect().width"); ok(w>50, '11) classic date tap area width = '+Math.round(w));
  // version shown
  ok(/v\d+\.\d+/.test(await pg.textContent('#verNote')), '   version in Settings: '+(await pg.textContent('#verNote')).trim());
  // J) saveJournal: writes to Daily Log headers Grateful / To Be / Top 3
  const jb={token:'t',action:'saveJournal',date:'2026-11-03',g1:'Health',g2:'Family',g3:'Work',tobe:'present',tohave:'strong',p1:'Task A',p2:'Task B',p3:'Task C',w1:'',w2:'',w3:'',h1:'',h2:'',h3:'',q:7,well:'Good run',didnt:'Skipped reading'};
  const jr=env.post(JSON.stringify(jb));
  ok(jr.ok, 'J) saveJournal ok = '+jr.ok+(jr.msgs&&jr.msgs.length?' msgs: '+jr.msgs.join('; '):''));
  const dl2=env.trk['Daily Log'].d[1];
  const gratIdx=env.trk['Daily Log'].d[0].indexOf('Grateful');
  const tobeIdx=env.trk['Daily Log'].d[0].indexOf('To Be / Have / Feel');
  const top3Idx=env.trk['Daily Log'].d[0].indexOf('Top 3');
  ok(gratIdx>0 && /Health/.test(String(dl2[gratIdx])), 'J1) Grateful col has "Health": col '+gratIdx+' = '+dl2[gratIdx]);
  ok(tobeIdx>0 && /present/.test(String(dl2[tobeIdx])), 'J2) ToBe col has "present": col '+tobeIdx+' = '+dl2[tobeIdx]);
  ok(top3Idx>0 && /Task A/.test(String(dl2[top3Idx])), 'J3) Top3 col has "Task A": col '+top3Idx+' = '+dl2[top3Idx]);
  // J4) no error msgs (doc write succeeded in mock)
  ok(Array.isArray(jr.msgs) && jr.msgs.every(m=>!/not found/i.test(m)), 'J4) no "not found" msgs: '+JSON.stringify(jr.msgs));
  // K) sets action: returns sets for a date that has workout log rows
  // Plant a row in Workout Log first
  env.str['Workout Log'].d.splice(1,0,[new Date(2026,10,3),'Weights','Curl',1,12,30,'','','',7,'']);
  const sr=env.get({token:'t',action:'sets',date:'2026-11-03'});
  ok(sr.date==='2026-11-03', 'K) sets date = '+sr.date);
  ok(Array.isArray(sr.sets)&&sr.sets.length>=1, 'K1) sets has rows: '+sr.sets.length);
  ok(sr.sets[0].exercise==='Curl', 'K2) first set exercise = '+sr.sets[0].exercise);
  // K3) sets for a date with no rows returns empty array
  const sr2=env.get({token:'t',action:'sets',date:'2025-01-01'});
  ok(Array.isArray(sr2.sets)&&sr2.sets.length===0, 'K3) no sets for unknown date: '+sr2.sets.length);
  await b.close();
  console.log(fails?`\n${fails} FAILED`:'\nALL PASSED'); process.exit(fails?1:0);
})();
