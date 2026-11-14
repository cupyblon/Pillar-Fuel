// Beta Train tab check (v6.5): big red button, rest countdown, +30s, pause, rest tracking.
// Loads beta/index.html (demo data only, no network) with a fake clock so rests take no real time.
// Run:  node tests/beta-train.js     (exit code 1 if anything fails)
const {chromium}=require('playwright'); const path=require('path');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const APP='file://'+path.join(__dirname,'..','beta','index.html');
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844}});
  pg.on('dialog',d=>d.accept()); pg.on('pageerror',e=>{ fails++; console.log('PAGE ERROR',e.message); });
  await pg.clock.install({time:new Date('2026-11-14T10:00:00')});
  await pg.goto(APP); await pg.clock.runFor(1000);
  const ff=async s=>{ await pg.clock.runFor(s*1000); };
  const vis=async sel=>await pg.evaluate(s=>{ const e=document.querySelector(s); return !!e&&e.getClientRects().length>0; },sel);
  await pg.evaluate("show('train'); addBlock(['Uphill sprint']); tr.blocks[0].rounds[0][0]={reps:1,time:20}; trSaveLS(); renderTrain()");
  ok(await pg.textContent('#verNote').then(t=>/v\d+(\.\d+)+-beta/.test(t)), 'B1) version label is a beta version');
  ok(!(await vis('#pad')), 'B2) big button hidden until asked for');
  await pg.click('[data-pad="0"]'); await ff(1);
  const box=await pg.locator('#padDone').boundingBox();
  ok(await vis('#pad') && box.width*box.height > 0.6*390*844, 'B3) big button covers '+Math.round(100*box.width*box.height/(390*844))+'% of the screen (want > 60%)');
  ok(await pg.textContent('#padBig')==='DONE' && /Round 1/.test(await pg.textContent('#padSub')), 'B4) shows DONE for round 1');
  // round 1 done -> rest 75s, run it out
  await pg.click('#padDone'); await ff(1);
  ok(await pg.getAttribute('#pad','data-mode')==='rest' && /^1:1[45]$/.test(await pg.textContent('#padBig')), 'B5) tap -> rest countdown: '+await pg.textContent('#padBig'));
  await pg.click('#padDone'); await ff(1);
  ok(await pg.evaluate("tr.blocks[0].rounds.length")===2, 'B6) tapping the big area during rest does not log another round');
  await ff(80);
  ok(await pg.getAttribute('#pad','data-mode')==='work' && /Round 2/.test(await pg.textContent('#padSub')), 'B7) countdown ends -> back to DONE for round 2');
  ok(await pg.evaluate("tr.blocks[0].rest[0]")===75, 'B8) round 1 rest recorded = '+await pg.evaluate("tr.blocks[0].rest[0]")+' s (want 75)');
  // round 2 done -> +30s twice, pause 60s (must not count), then run out
  await pg.click('#padDone'); await ff(10);
  await pg.click('#padAdd'); await pg.click('#padAdd'); await ff(5);
  await pg.click('#padPause'); const frozen=await pg.textContent('#padSub'); await ff(60);
  ok(await pg.getAttribute('#pad','data-mode')==='paused' && await pg.textContent('#padSub')===frozen, 'B9) pause freezes the rest countdown: '+frozen);
  const tPaused=await pg.evaluate("trElapsed()");
  await ff(30); ok(Math.abs(await pg.evaluate("trElapsed()")-tPaused)<1000, 'B10) pause freezes the session clock');
  await pg.click('#padPause'); await ff(125);
  ok(await pg.evaluate("tr.blocks[0].rest[1]")===135 && await pg.evaluate("tr.blocks[0].adds[1]")===2, 'B11) round 2 rest = '+await pg.evaluate("tr.blocks[0].rest[1]")+' s with '+await pg.evaluate("tr.blocks[0].adds[1]")+' adds (want 135 s, 2 adds; the 90 s pause is left out)');
  // round 3 done -> skip rest after 20s
  await pg.click('#padDone'); await ff(20); await pg.click('#padSkip'); await ff(1);
  ok(await pg.evaluate("tr.blocks[0].rest[2]")===20, 'B12) skipped rest recorded as actually rested = '+await pg.evaluate("tr.blocks[0].rest[2]")+' s (want 20)');
  ok(await pg.textContent('#trRest')==='3:50' && await pg.textContent('#trAdds')==='2', 'B13) summary: rest '+await pg.textContent('#trRest')+', +30s × '+await pg.textContent('#trAdds')+' (want 3:50, 2)');
  const sets=await pg.evaluate("trSets()");
  ok(sets.length===3 && sets.map(s=>s.rest).join()==='75,135,20' && /\+30s × 2/.test(sets[1].notes), 'B14) sets carry real rest: '+sets.map(s=>s.rest).join()+' · note: '+sets[1].notes);
  // works for any exercise, and the small button still works without the big one
  await pg.click('#padX'); await ff(1);
  ok(!(await vis('#pad')), 'B15) Close hides the big button');
  await pg.evaluate("addBlock(['Curl','Triceps kickback'])"); await ff(1);
  await pg.click('[data-round="1"]'); await ff(5);
  ok(await vis('#restBar') && /Rest 1:2/.test(await pg.textContent('#restTxt')), 'B16) small "Round done" button still starts the rest bar: '+await pg.textContent('#restTxt'));
  await pg.click('#restPause'); await ff(40);
  ok(/Paused/.test(await pg.textContent('#restTxt')) && await pg.textContent('#restPause')==='Resume', 'B17) rest bar has Pause/Resume: '+await pg.textContent('#restTxt'));
  await pg.click('#restPause'); await pg.click('#restStop'); await ff(1);
  ok(await pg.evaluate("tr.blocks[1].rest[0]")===5, 'B18) superset rest stopped early = '+await pg.evaluate("tr.blocks[1].rest[0]")+' s (want 5)');
  await pg.click('[data-pad="1"]'); await ff(1);
  ok(/Curl \+ Triceps kickback/.test(await pg.textContent('#padTitle')), 'B19) big button works for a superset: '+await pg.textContent('#padTitle'));
  await pg.click('#padX');
  // untimed rounds keep the planned value, as before
  await pg.evaluate("addBlock(['Squat']); tr.blocks[2].rounds[0][0]={reps:10,w:100}; trSaveLS(); renderTrain()");
  ok((await pg.evaluate("trSets()")).find(s=>s.exercise==='Squat').rest===75, 'B20) round with no timer keeps the planned 75 s');
  // pause with no rest running, then save: minutes leave out the pause
  await pg.click('#trPause'); const before=await pg.evaluate("trElapsed()"); await ff(600);
  ok(Math.abs(await pg.evaluate("trElapsed()")-before)<1000 && /paused/.test(await pg.textContent('#trStatus')), 'B21) "Pause workout" stops the clock with no rest running');
  await pg.click('#trSave'); await ff(1);
  const t=await pg.evaluate("({saved:tr.saved,pauseAt:tr.pauseAt,mins:Math.round(trElapsed()/60000)})");
  ok(t.saved && !t.pauseAt && t.mins<=6, 'B22) saved; session minutes = '+t.mins+' (pauses left out; wall clock was ~17)');
  await b.close(); console.log(fails?('\n'+fails+' FAILED'):'\nALL PASSED'); process.exit(fails?1:0);
})();
