// Beta Money tab check (v7.0): renders the read-only budget view from sample numbers.
// Run:  node tests/beta-money.js     (exit code 1 if anything fails)
const {chromium}=require('playwright'); const path=require('path');
let fails=0; const ok=(c,m)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+m); };
const APP='file://'+path.join(__dirname,'..','beta','index.html');
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:390,height:844}});
  pg.on('dialog',d=>d.accept()); pg.on('pageerror',e=>{ fails++; console.log('PAGE ERROR',e.message); });
  let net=0; pg.on('request',r=>{ if(/^https?:/.test(r.url())) net++; });
  await pg.clock.setFixedTime(new Date('2026-11-14T10:00:00'));   // sample data runs through Nov 2026
  await pg.goto(APP); await pg.waitForTimeout(600);
  await pg.click('nav button[data-v="money"]'); await pg.waitForTimeout(300);
  const tx=s=>pg.textContent(s);
  ok(await pg.evaluate("!document.querySelector('#v-money').classList.contains('hide')"), 'N1) Money tab opens from the nav');
  ok(await tx('#mnIn')==='$2,500' && await tx('#mnOut')==='$2,874' && await tx('#mnPlan')==='$3,080', 'N2) income '+await tx('#mnIn')+', spent '+await tx('#mnOut')+' of '+await tx('#mnPlan'));
  ok(await tx('#mnNet')==='−$699', 'N3) net cash flow shown: '+await tx('#mnNet'));
  const over=await pg.$$eval('#mnOver .mrow .a',e=>e.map(x=>x.firstChild.textContent));
  ok(over.join()==='Car maintenance,Dining out,Electric', 'N4) over-budget lines, biggest first: '+over.join());
  ok(/no budget set/.test(await tx('#mnOver')), 'N5) a $0-budget line with spending says "no budget set"');
  ok(/\$208\.50 open · \$171\.40 paid/.test(await tx('#mnBillN')), 'N6) bills header: '+await tx('#mnBillN'));
  ok(await pg.$$eval('#mnLines .nu',e=>e.length)===12, 'N7) every line listed (12)');
  ok(/sample numbers/.test(await tx('#mnStatus')), 'N8) beta labels the numbers as samples: '+await tx('#mnStatus'));
  ok(/Due Nov 25/.test(await tx('#mnBills')) && /Due Nov 5/.test(await tx('#mnBills')), 'N11) every bill shows its due date, paid ones too');
  await pg.click('#mnPrev'); await pg.waitForTimeout(200);
  ok(await tx('#mnMonth')==='Oct 2026' && /Due Oct 25/.test(await tx('#mnBills')), 'N12) ‹ steps back one month: '+await tx('#mnMonth'));
  await pg.click('#mnNext'); await pg.waitForTimeout(200);
  ok(await tx('#mnMonth')==='Nov 2026' && await pg.evaluate("$('#mnNext').disabled"), 'N13) › steps forward and stops at the current month');
  ok(await pg.evaluate("state.date")==='2026-11-14' && !(await pg.$('#mnYear')), 'N14) month arrows leave the logging date alone; no month-by-month card');
  await pg.evaluate("mnSel=null; loadMoney()"); await pg.waitForTimeout(200);
  await pg.click('#mnRefresh'); await pg.waitForTimeout(300);
  ok(net===0, 'N9) beta made '+net+' network calls (want 0: it never talks to the sheets)');
  const w=await pg.evaluate("Math.max(...[...document.querySelectorAll('nav button')].map(b=>b.scrollWidth-b.clientWidth))");
  ok(w<=0, 'N10) 8 nav buttons fit on a phone with no clipped label (overflow '+w+'px)');
  if(process.env.SHOT) await pg.screenshot({path:process.env.SHOT,fullPage:true});
  await b.close(); console.log(fails?('\n'+fails+' FAILED'):'\nALL PASSED'); process.exit(fails?1:0);
})();
