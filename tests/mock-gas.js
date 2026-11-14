// Minimal in-memory Google Apps Script mock that runs the real Code.gs.
const fs=require('fs'), vm=require('vm'), path=require('path');
// Code under test: the real backend (override with GS=/path/to/Code.gs).
const CODE=process.env.GS||path.join(__dirname,'..','apps-script','Code.gs');
function Sheet(name,rows,maxRows){ this.name=name; this.d=rows.map(r=>r.slice()); this.max=maxRows||Math.max(rows.length,50); }
Sheet.prototype={
  cell(r,c){ const row=this.d[r-1]||[]; const v=row[c-1]; return v===undefined?'':v; },
  put(r,c,v){ if(this.formulaCols&&r>=2&&this.formulaCols.includes(c)) (this.badWrites=this.badWrites||[]).push(String.fromCharCode(64+c)+r+'='+JSON.stringify(v));
    while(this.d.length<r) this.d.push([]); this.d[r-1][c-1]=v; if(r>this.max) this.max=r; },
  getLastRow(){ for(let i=this.d.length;i>0;i--) if((this.d[i-1]||[]).some(v=>v!==''&&v!==undefined)) return i; return 0; },
  getLastColumn(){ return Math.max(...this.d.map(r=>r.length)); },
  getMaxRows(){ return this.max; }, insertRowsAfter(a,n){ this.max+=n; },
  getRange(r,c,nr,nc){ if(typeof r==='string'){ return r==='A1:D16'?this.getRange(1,1,16,4):this.getRange(1,1,this.max,1); } nr=nr||1; nc=nc||1; const sh=this;
    const R={ getValues(){ const o=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++) row.push(sh.cell(r+i,c+j)); o.push(row);} return o; },
      getDisplayValues(){ return R.getValues().map(x=>x.map(v=>v instanceof Date?v.toISOString().slice(0,10):String(v))); },
      setValues(v){ v.forEach((row,i)=>row.forEach((x,j)=>sh.put(r+i,c+j,x))); return R; },
      setValue(x){ sh.put(r,c,x); return R; }, getValue(){ return sh.cell(r,c); },
      clearContent(){ for(let i=0;i<nr;i++) for(let j=0;j<nc;j++) sh.put(r+i,c+j,''); return R; },
      setNumberFormat(){ return R; } }; return R; } };
function makeEnv(){
  const d=s=>{ const [y,m,dd]=s.split('-').map(Number); return new Date(y,m-1,dd); };
  const foods=[['Foods'],['Egg, whole (chicken)','Eggs','1 large',50,143,12.6,9.5],['Beef, ribeye','Beef','4 oz',113,291,24,21],['Monster Energy Zero Ultra','Drinks','1 can',473,2.11,0,0,0,0,0,0,0.85,...Array(26).fill(''),31.7,0.42,'',0]];
  const nut={ 'Food Log':new Sheet('Food Log',[['Date','Food','Amount','Unit']],100),'Foods':new Sheet('Foods',foods),
    'Goals':new Sheet('Goals',[['Phase','Cut'],['Calories',2540],['Protein',195],['Fat',187],['Net carbs (max)',36],['Water',128],['Steps',8000],['Exercise',30],['Weight goal',195],['Starting weight',235],['Latest weight',233]]),'Targets':new Sheet('Targets',[['x']]),'Daily Totals':new Sheet('Daily Totals',[['Date']]),
    'Daily Body':new Sheet('Daily Body',[['Date','Weight','Avg','Steps','Water','Ex','Note','Training'],[d('2026-11-03'),233,'',8000,64,'','','']]),
    'Deep Dive':new Sheet('Deep Dive',[[''],[''],['h']]) };
  const head=['Date','Wins','Misses','Breakfast','Lunch','Dinner','Snacks / Drinks','Monsters #','Exercise Types','Exercise Min','Sweat? (Y/N)','Woke','Bed','Grateful','To Be / Have / Feel','Top 3'];
  const trk={ 'Daily Log':new Sheet('Daily Log',[head,[d('2026-11-03'),'','','','','','',2,'','','','6:00 AM','','','','']]) };
  nut['Daily Body'].formulaCols=[3,8];   // C and H are column-filling formulas in the real sheet
  const str={ 'Workout Log':new Sheet('Workout Log',[['Date','Type','Exercise','Set','Reps','Wt','Time','Dist','Rest','Effort','Notes']],100),
    'Sessions':new Sheet('Sessions',[['Date','Type','Min','Note']]),'Exercises':new Sheet('Exercises',[['n','g','e']]) };
  // Budget 2026 month tab + Bill Tracker (v7.0 Money tab). Extra rows on purpose: the backend must find lines by name.
  const bud={ 'Nov 2026 budget':new Sheet('Nov 2026 budget',[['Nov 2026'],[],['Item','Budget','Actual'],['INCOME'],['Salary',6000,3000],['Total income',6000,3000],[],
    ['NECESSARY'],['Mortgage',1800,1800],['A brand new line',0,40],['Food','600.00',700],['Total necessary',2400,2540],[],['DISCRETIONARY'],['Dining out',180,90],['Total discretionary',180,90],[],
    ['INVESTMENT'],['Bitcoin DCA (Fold)',450,200],['Total investment',450,200],[],['Net cash flow (income - all spending)',2970,170],[],
    ['PAYCHECK BREAKDOWN','Monthly avg','This month'],['Gross pay',9000,4500],[],['True savings (Roth + HSA + Bitcoin DCA)',1400,650],[],['Health care paid from HSA (info only - not in totals)','',25]]) };
  bud['Oct 2026 budget']=new Sheet('Oct 2026 budget',[['INCOME'],['Salary',6000,6100],['Total income',6000,6100],['NECESSARY'],['Mortgage',1800,1900],['Total necessary',1800,1900],['DISCRETIONARY'],['Dining out',180,300],['Total discretionary',180,300],['Net cash flow (income - all spending)',4020,3900]]);
  bud['Jun 2026 actuals']=new Sheet('Jun 2026 actuals',[['INCOME'],['Salary',1,1],['Total income',1,1]]);   // old layout/name: must be ignored
  const bil={ 'Untitled':new Sheet('Untitled',[['Bill Tracker'],[],[],['Vendor','Amount Due','Due Date','Status','Paid On','Notes / Source'],
    ['Old Paid Co',50,d('2026-09-10'),'Paid',d('2026-09-09'),''],['Power Co',120,d('2026-11-05'),'Paid',d('2026-11-04'),''],['Phone Co',228.56,d('2026-11-25'),'Invoiced','',''],['Late Co',75,d('2026-10-20'),'Overdue','',''],['Blank Co','','','','','fill from bill'],['Template Co',99,d('2026-08-01'),'Placeholder','',''],['Yearly Co','',d('2027-02-01'),'','',''],['NoAmt Paid Co','','','Paid',d('2026-11-02'),'']]) };
  const books={'1TmlnhFuHJ5SWfY5lR7xMevsoGAAcavCeYDdx-231tfI':bud,'1TXqoiVJ3RxzzLCLMMA7rlSjlnDkALSrYmx__pwN95pk':bil,'1mAkG128NSk-IzEJg-EZTNbNBz7YmmhnlBjJJAYMoyhA':nut,'1f2wlJqIKezVA1OHgX1OyHAwTmrXsCE019LNKDu0UvuA':trk,'1LYztTug2l94R81f5B0mgak0F3pR9GkM-g1hyBuWETpo':str};
  const props={APP_TOKEN:'t'}; const opens={n:0};
  const files=[{name:'2026-11-03 Daily Plan',trashed:true,id:'OLD',upd:new Date(2026,10,3,9)},{name:'2026-11-03 Daily Plan',trashed:false,id:'GOOD',upd:new Date(2026,10,3,5)}];
  const ctx={ console, Date, JSON, Math, Number, String, isNaN, RegExp, Array, Object,
    SpreadsheetApp:{ openById(id){ opens.n++; const b=books[id]; return { getSheetByName:n=>b[n]||null }; } },
    PropertiesService:{ getScriptProperties:()=>({ getProperty:k=>props[k]??null, setProperty:(k,v)=>{props[k]=v;} }) },
    LockService:{ getScriptLock:()=>({ waitLock(){}, releaseLock(){} }) },
    CacheService:{ getScriptCache:()=>({ get:k=>null, put(){}, remove(){} }) },
    ContentService:{ MimeType:{JSON:'json'}, createTextOutput:t=>({ t, setMimeType(){ return this; } }) },
    Utilities:{ formatDate(dt,tz,f){ const p=n=>String(n).padStart(2,'0'); return f==='HH:mm'?p(dt.getHours())+':'+p(dt.getMinutes()):dt.getFullYear()+'-'+p(dt.getMonth()+1)+'-'+p(dt.getDate()); }, getUuid:()=>'x' },
    DriveApp:{ getFolderById:()=>({ getFilesByName(n){ const l=files.filter(f=>f.name===n&&!f.trashed); let i=0; return { hasNext:()=>i<l.length, next:()=>{ const f=l[i++]; return { getId:()=>f.id, isTrashed:()=>false, getLastUpdated:()=>f.upd, getUrl:()=>'https://docs.google.com/document/d/'+f.id }; } }; } }) },
    DocumentApp:{ ElementType:{PARAGRAPH:'PARAGRAPH',LIST_ITEM:'LIST_ITEM',HEADING:'HEADING'},
      ParagraphHeading:{NORMAL:'NORMAL',HEADING1:'HEADING_1',HEADING2:'HEADING_2'},
      openById(id){
      // Minimal doc mock with MORNING JOURNAL section
      const paras=[
        {type:'PARAGRAPH',text:'MORNING JOURNAL',heading:'HEADING_2'},
        {type:'PARAGRAPH',text:'GRATEFUL (3)',heading:'NORMAL'},
        {type:'LIST_ITEM',text:'1) ',heading:'NORMAL'},
        {type:'LIST_ITEM',text:'2) ',heading:'NORMAL'},
        {type:'LIST_ITEM',text:'3) ',heading:'NORMAL'},
        {type:'PARAGRAPH',text:'TO BE (love, support, build)',heading:'NORMAL'},
        {type:'LIST_ITEM',text:'Today I want to be: ',heading:'NORMAL'},
        {type:'LIST_ITEM',text:'Today I want to: ',heading:'NORMAL'},
        {type:'PARAGRAPH',text:'DAILY LOG',heading:'HEADING_2'},
      ];
      const Body={
        getNumChildren(){ return paras.length; },
        getChild(i){ const p=paras[i];
          return {
            getType(){ return p.type==='LIST_ITEM'?'LIST_ITEM':'PARAGRAPH'; },
            asParagraph(){
              return { getHeading(){ return p.heading; },
                getText(){ return p.text; },
                editAsText(){ return { setText(v){ p.text=v; } }; } };
            },
            asListItem(){
              return { getHeading(){ return 'NORMAL'; },
                getText(){ return p.text; },
                editAsText(){ return { setText(v){ p.text=v; } }; } };
            } }; }
      };
      return { getBody(){ return Body; }, saveAndClose(){}, getId(){ return id; } };
    } },
    UrlFetchApp:{ fetch:u=>({ getResponseCode:()=>200, getContentText:()=>'# doc '+(u.includes('GOOD')?'GOOD':'OLD') }) },
    ScriptApp:{ getOAuthToken:()=>'x' }, Logger:{log(){}} };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(CODE,'utf8'),ctx);
  return { ctx, nut, trk, str, props, opens,
    get(q){ return JSON.parse(ctx.doGet({parameter:q}).t); },
    post(body){ return JSON.parse(ctx.doPost({postData:{contents:body}}).t); } };
}
module.exports={makeEnv};
