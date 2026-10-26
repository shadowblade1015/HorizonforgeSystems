// Audit-only observations against generated output. No production code mutations.
import {createServer} from 'node:http';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readTree,root} from './verify-source.mjs';
import {chromeAudit,until} from './chrome-audit.mjs';
const out=resolve(root,process.env.HFS_PHASE4_EVIDENCE||'.phase2-backup/phase4-browser');mkdirSync(out,{recursive:true});
const files=readTree(resolve(root,'dist')),release=JSON.parse(files.get('ember-solitaire/release.json'));
const requests=[],checks=[],labs=[],errors=[],failedRequests=[];
let networkOnline=true;
const server=createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=u.pathname.slice(1)+(u.pathname.endsWith('/')?'index.html':'');
 const b=files.get(p),status=b?200:404;requests.push({path:p,status,bytes:b?.length||0});
 if(!networkOnline){res.destroy();return;}
 res.writeHead(status,{'Cache-Control':'no-store','Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png'})[extname(p)]||'text/plain'});res.end(b||'Not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,base=origin+'/ember-solitaire/';let chrome,page,motionChrome;
const record=(name,pass,detail)=>{checks.push({name,status:pass?'PASS':'FAIL',detail});console.log((pass?'PASS ':'FAIL ')+name);};
const shot=async(tab,name)=>writeFileSync(resolve(out,name+'.png'),Buffer.from((await tab.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
const rpc=data=>`new Promise((resolve,reject)=>{const c=new MessageChannel(),t=setTimeout(()=>reject(Error('RPC timeout')),15000);c.port1.onmessage=e=>{clearTimeout(t);c.port1.close();resolve(e.data)};navigator.serviceWorker.controller.postMessage(${JSON.stringify(data)},[c.port2])})`;
const observe=`self.audit={lcp:[],cls:[],long:[],draws:0,searches:[],mainSearchCalls:0};
const NativeWorker=self.Worker;self.Worker=class extends NativeWorker{constructor(url,...args){super(url,...args);this.auditURL=new URL(url,document.baseURI).href;this.addEventListener('message',e=>{const d=e.data;audit.searches.push({event:'reply',url:this.auditURL,id:d.id,type:d.type,status:d.status,elapsedMs:d.elapsedMs,at:performance.now()});if(d.type==='endgame')self.auditBoardSolve={ms:d.elapsedMs,status:d.status,url:this.auditURL,at:performance.now()}})}postMessage(d,...args){audit.searches.push({event:'request',url:this.auditURL,id:d.id,type:d.type,at:performance.now()});return super.postMessage(d,...args)}};
for(const [type,key]of [['largest-contentful-paint','lcp'],['layout-shift','cls'],['longtask','long']])try{new PerformanceObserver(l=>l.getEntries().forEach(e=>audit[key].push({start:e.startTime,duration:e.duration,value:e.value||0,recent:!!e.hadRecentInput,size:e.size||0,url:e.url||''}))).observe({type,buffered:true})}catch{}
const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...args){if(this.canvas.id==='emberField')audit.draws++;return original.apply(this,args)};`;
const frames=async(tab,ms=1500)=>tab.evaluate(`new Promise(resolve=>{const a=[],start=performance.now();let last=start;function frame(t){a.push(t-last);last=t;if(t-start<${ms})requestAnimationFrame(frame);else{a.sort((x,y)=>x-y);resolve({samples:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:Math.max(...a),over50:a.filter(x=>x>50).length})}}requestAnimationFrame(frame)})`);
const metrics=tab=>tab.evaluate(`(()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');let cls=0,sum=0,start=0,last=0;for(const x of audit.cls.filter(x=>!x.recent)){if(!sum||x.start-last>1000||x.start-start>5000){start=x.start;sum=0}sum+=x.value;last=x.start;cls=Math.max(cls,sum)}return {now:performance.now(),visibility:document.visibilityState,navigation:n?.toJSON(),lcp:audit.lcp.at(-1)||null,cls,longTasks:audit.long,resources:r.map(x=>({name:x.name,duration:x.duration,transfer:x.transferSize,encoded:x.encodedBodySize,decoded:x.decodedBodySize,initiator:x.initiatorType})),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null}})()`);
try {
 chrome=await chromeAudit();const browser=await chrome.send('Browser.getVersion');
 for(const config of [{name:'desktop-cold',width:1440,height:900,cpu:1,latency:0,down:-1},{name:'phone-lab-4x-fast4g',width:390,height:844,cpu:4,latency:40,down:200000}]){
  const {browserContextId}=await chrome.send('Target.createBrowserContext');const tab=await chrome.tab(browserContextId);page=tab;
  await tab.call('Page.bringToFront');await tab.call('Emulation.setDeviceMetricsOverride',{width:config.width,height:config.height,deviceScaleFactor:1,mobile:config.width<500});
  await tab.call('Emulation.setCPUThrottlingRate',{rate:config.cpu});await tab.call('Network.emulateNetworkConditions',{offline:false,latency:config.latency,downloadThroughput:config.down,uploadThroughput:config.down});
  await tab.call('Network.setCacheDisabled',{cacheDisabled:true});await tab.call('Page.addScriptToEvaluateOnNewDocument',{source:observe});
  await tab.navigate(base+'?nosw');await until(()=>tab.evaluate('ES?.UI?.current==="intro"&&!!document.querySelector("#introGo")'),'first-time intro',60000);
  const intro=await tab.evaluate('performance.now()');record(config.name+' first-time intro reached',true,{ms:intro});
  await tab.evaluate('document.querySelector("#introGo").click();document.querySelector(".choose-opt[data-id=shield]").click();document.querySelector("#chooseGo").click();document.querySelector("#beginGo").click()');
  await until(()=>tab.evaluate('ES?.UI?.current==="game"&&document.querySelectorAll(".card").length===54'),'tutorial board',30000);
  const playable=await tab.evaluate('performance.now()');record(config.name+' actual onboarding creates playable tutorial',await tab.evaluate('ES.Store.state.game.tutorial&&ES.Store.state.artifact==="shield"'),{ms:playable});
  await tab.evaluate('document.querySelector("[data-t=skip]")?.click();ES.Store.state.ftue.intro=true;ES.Store.state.ftue.tutorial=true;ES.Store.save(true)');
  await shot(tab,config.name);await new Promise(r=>setTimeout(r,100));const initial=await metrics(tab);
  const interactions=[];
  for(const suits of [1,2,4]){
   const result=await tab.evaluate(`(()=>{const g=ES.Engine.newGame(${suits},{seed:42});ES.Store.startGame(g);ES.UI.go("game");ES.Board.start(g);const m=ES.Engine.hintBasic(g),before=performance.now();let moved=false,undo=false;if(m){moved=ES.Board.doMove(m.from,m.idx,m.to);ES.Board.doUndo();undo=g.moves===0}const stock=g.stock.length;ES.Board.doDeal();const dealt=g.stock.length===stock-10;ES.Board.doUndo();const restored=g.stock.length===stock;return {suits:g.suits,valid:ES.Store.validateHand(g),moved,undo,dealt,restored,ms:performance.now()-before,cards:g.cols.flat().length+g.stock.length+13*g.completed}})()`);
   record(config.name+' '+suits+'-suit move/deal/undo invariant',result.valid&&result.moved&&result.undo&&result.dealt&&result.restored&&result.cards===104,result);interactions.push(result);
  }
  const animation=await frames(tab);const solver=[];
  for(const seed of [1,42,100]){
   const result=await tab.evaluate(`new Promise((resolve,reject)=>{const g=ES.Engine.newGame(4,{seed:${seed}});while(g.stock.length)ES.Engine.deal(g);g.cols.flat().forEach(c=>c.up=true);g.history=[];ES.Store.validateHand(g);const w=new Worker('js/stuck-worker.js'),timer=setTimeout(()=>{w.terminate();reject(Error('Benchmark timeout'))},8000);w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error('Benchmark worker failed'))};w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve({seed:${seed},ms:e.data.elapsedMs,status:e.data.status,source:'worker'})};w.postMessage({type:'endgame',id:0,session:0,revision:0,workEpoch:0,cols:g.cols,stock:g.stock,completed:g.completed})})`);solver.push(result);
  }
  // Measure the real scheduled Board path, not only CDP-evaluated calls. The
  // Worker messages provide duration; any main-thread search call fails this gate.
  await tab.evaluate(`self.auditBoardSolve=null;self.auditSolveOriginal=ES.Engine.solveEndgame;self.auditStuckOriginal=ES.Engine.isStuck;ES.Engine.solveEndgame=function(...args){audit.mainSearchCalls++;return auditSolveOriginal(...args)};ES.Engine.isStuck=function(...args){audit.mainSearchCalls++;return auditStuckOriginal(...args)};const stress=ES.Engine.newGame(4,{seed:42});while(stress.stock.length)ES.Engine.deal(stress);stress.cols.flat().forEach(c=>c.up=true);stress.history=[];ES.Store.validateHand(stress);ES.Store.state.settings.reduced=true;ES.Store.startGame(stress);ES.UI.go('game');ES.Board.start(stress);audit.solveStart=performance.now()`);
  const solverFrames=await frames(tab,3000);await until(()=>tab.evaluate('!!self.auditBoardSolve'),'scheduled board solver');
  const boardSolver=await tab.evaluate('({...auditBoardSolve,mainSearchCalls:audit.mainSearchCalls,requests:audit.searches.filter(x=>x.at>=audit.solveStart),longTasks:audit.long.filter(x=>x.start>=audit.solveStart)})');await tab.evaluate('ES.Engine.solveEndgame=auditSolveOriginal;ES.Engine.isStuck=auditStuckOriginal');
  record(config.name+' Board planning uses the matching immutable worker without synchronous searches',boardSolver.mainSearchCalls===0&&boardSolver.url.includes('/_releases/'+release.id+'/js/stuck-worker.js'),boardSolver);
  await new Promise(r=>setTimeout(r,100));const afterSolver=await metrics(tab);
  const churnBefore=await tab.call('Memory.getDOMCounters');const heapBefore=await tab.call('Runtime.getHeapUsage');
  for(let n=0;n<20;n++)await tab.evaluate(`ES.Screens.newGame(${[1,2,4][n%3]});ES.Board.doDeal();ES.Board.doUndo();ES.UI.go('home');ES.Screens.resumeGame();true`);
  await tab.call('HeapProfiler.collectGarbage');const churnAfter=await tab.call('Memory.getDOMCounters'),heapAfter=await tab.call('Runtime.getHeapUsage');const targets=await chrome.send('Target.getTargets');
  labs.push({config,introMs:intro,playableMs:playable,initial,interactions,animation,solver,boardSolver,solverFrames,afterSolver,churn:{iterations:20,before:churnBefore,after:churnAfter,heapBefore,heapAfter,workers:targets.targetInfos.filter(t=>t.type==='worker').length}});
  if(config.name==='desktop-cold'){
   // Isolate interactive media changes from intrusive heap/GC profiling.
   motionChrome=await chromeAudit();const motionTab=await motionChrome.tab();page=motionTab;await motionTab.call('Page.addScriptToEvaluateOnNewDocument',{source:observe});
   await motionTab.navigate(base+'?nosw&screen=home');await motionTab.call('Page.bringToFront');
   await until(()=>motionTab.evaluate('ES?.UI?.current==="home"'),'motion screen');
   // Existing bundle behavior with changing OS preference, not a source rewrite.
   await motionTab.evaluate('ES.Store.state.settings.reduced=false;ES.UI.go("home");ES.FX.setField("home")');
   await until(()=>motionTab.evaluate('audit.draws>0'),'ambient draws before preference change');
   await motionTab.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   // Flush the emulation change through Chrome's rendering event cycle.
   await motionTab.evaluate('new Promise(requestAnimationFrame)');
   await until(()=>motionTab.evaluate('!ES.FX.motion()&&document.querySelector("#emberField").style.opacity==="0"'),'dynamic reduced motion applied');
   const before=await motionTab.evaluate('audit.draws');await new Promise(r=>setTimeout(r,250));
   const reduced=await motionTab.evaluate('({motion:ES.FX.motion(),draws:audit.draws,opacity:getComputedStyle(document.querySelector("#emberField")).opacity})');
   record('OS reduced-motion change stops existing ambient canvas',reduced.draws===before,{before,...reduced});
   await motionTab.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
   await motionTab.evaluate('new Promise(requestAnimationFrame)');
   await until(()=>motionTab.evaluate('ES.FX.motion()&&audit.draws>'+reduced.draws),'active motion resumes');const restored=await motionTab.evaluate('audit.draws');
   record('OS normal motion restores active ambient draws',restored>reduced.draws,{restored,stopped:reduced.draws});
   await motionTab.evaluate('ES.Store.state.settings.reduced=true;ES.UI.applySettings()');const settingStopped=await motionTab.evaluate('audit.draws');
   await motionTab.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   await motionTab.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
   await new Promise(r=>setTimeout(r,100));record('in-game reduced motion remains authoritative over OS changes',await motionTab.evaluate('audit.draws')===settingStopped);
   await motionChrome.close();motionChrome=null;page=tab;await tab.call('Page.bringToFront');
   // Canonical final-set fixture, not a claim of a human-played complete hand.
   const victory=await tab.evaluate(`(()=>{ES.Store.state.settings.reduced=true;const g=ES.Engine.newGame(1,{seed:42}),c=ES.Engine.newDeck(1,()=>0).filter(x=>parseInt(x.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);c.forEach(x=>x.up=true);g.cols=[c.slice(0,12),[c[12]],...Array.from({length:8},()=>[])];g.stock=[];g.completed=g.bestCompleted=7;ES.Store.startGame(g);ES.UI.go('game');ES.Board.start(g);ES.Store.validateHand(g);const before=ES.Store.state.stats.wins;ES.Board.doMove(1,0,0);return ES.Store.state.stats.wins===before+1})()`);
   await until(()=>tab.evaluate('!!document.querySelector(".ceremony")'),'victory ceremony');record('canonical victory settles and presents',victory);await shot(tab,'victory');
   await tab.evaluate('ES.Board.doUndo();ES.UI.go("daily");document.querySelector("#dailyPlay").click()');record('daily screen starts actual two-suit daily hand',await tab.evaluate('ES.Store.state.game.daily&&ES.Store.state.game.suits===2'));
   await tab.evaluate('ES.UI.go("collection");ES.UI.go("profile");ES.UI.go("settings");ES.UI.saveRecovery()');record('statistics/settings/recovery render without exception',await tab.evaluate('!!document.querySelector("#saveImport")'));await shot(tab,'save-recovery');
   // Exercise real file import and export interfaces with disposable synthetic data.
   await tab.call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out,browserContextId,eventsEnabled:true});
   await tab.evaluate('document.querySelector("#saveExport").click()');await until(()=>chrome.events.some(e=>e.method==='Browser.downloadProgress'&&e.params.state==='completed'),'export download');
   record('recovery export completes an actual browser download',true);
   const importResult=await tab.evaluate(`(async()=>{self.auditExport=ES.Store.exportSave();const p=JSON.parse(auditExport);p.embers=432;const f=new File([JSON.stringify(p)],'audit.json',{type:'application/json'}),dt=new DataTransfer();dt.items.add(f);const input=document.querySelector('#saveImport');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
   await until(()=>tab.evaluate('document.querySelector(".overlay:last-child")?.textContent.includes("Import this save")'),'import confirmation');
   await tab.evaluate('[...document.querySelectorAll(".overlay:last-child button")].find(b=>b.textContent.includes("Import this save")).click()');record('validated file import confirms and preserves selected amount',importResult&&await tab.evaluate('ES.Store.state.embers===432'));
   // Corrupt and future data are injected only into this disposable partition.
   for(const raw of ['{broken','{"v":99,"savedAt":1,"future":"keep"}']){
    await tab.evaluate(`localStorage.setItem(ES.Store.KEY,${JSON.stringify(raw)});ES.Store.load();ES.UI.go('settings');true`);
    record(raw.startsWith('{broken')?'malformed save remains protected':'future save remains protected',await tab.evaluate(`ES.Store.persistence.blocked&&localStorage.getItem(ES.Store.KEY)===${JSON.stringify(raw)}`));
   }
   await shot(tab,'future-save-protected');
  }
  await chrome.send('Target.disposeBrowserContext',{browserContextId});
 }
 // Actual cross-tab writers in a separate disposable storage partition.
 const multi=await chrome.send('Target.createBrowserContext');
 const first=await chrome.tab(multi.browserContextId);await first.navigate(base+'?screen=home&nosw');await until(()=>first.evaluate('ES?.UI?.current==="home"'),'first concurrent tab');
 await first.evaluate('ES.Store.save(true)');const second=await chrome.tab(multi.browserContextId);await second.navigate(base+'?screen=home&nosw');await until(()=>second.evaluate('ES?.UI?.current==="home"'),'second concurrent tab');
 await first.call('Page.bringToFront');await first.evaluate('ES.Store.addEmber(100,"audit");ES.Store.save(true)');
 const beforeWrite=await first.evaluate('JSON.parse(localStorage.getItem(ES.Store.KEY)).totalEmber');
 const beforeBackup=await first.evaluate('localStorage.getItem(ES.Store.BACKUP_KEY)');
 await second.evaluate('ES.Store.state.settings.music=0;ES.Store.save(true)');
 const overwritten=await second.evaluate('({main:JSON.parse(localStorage.getItem(ES.Store.KEY)).totalEmber,backup:JSON.parse(localStorage.getItem(ES.Store.BACKUP_KEY)).totalEmber,status:ES.Store.persistence.code})');
 record('stale second tab preserves newer earned progress',overwritten.main===beforeWrite&&overwritten.status!=="saved"&&await second.evaluate('localStorage.getItem(ES.Store.BACKUP_KEY)')===beforeBackup,{before:beforeWrite,...overwritten});
 await chrome.send('Target.disposeBrowserContext',multi);
 // Current generated release, actual SW, separate from the nosw performance runs.
 const tab=await chrome.tab();page=tab;await tab.call('Page.bringToFront');const installStart=Date.now();await tab.navigate(base+'?screen=home');
 await until(()=>tab.evaluate('ES?.UI?.current==="home"&&!!navigator.serviceWorker.controller'),'current worker control',45000);
 await until(()=>tab.evaluate(rpc({type:'STATUS'})).then(s=>s.ok),'current core ready');const installMs=Date.now()-installStart;
 const cache='ember-solitaire:'+encodeURIComponent(base)+':release-v1:'+release.id;
 const quota=await tab.evaluate('navigator.storage.estimate()');record('generated core installs with ready catalog',true,{installMs,coreBytes:release.files.filter(f=>f.core).reduce((n,f)=>n+f.bytes,0),quota});
 const laterFocus=await tab.evaluate('(()=>{const b=[...document.querySelectorAll(".offline-status button")].find(b=>b.textContent==="Later");b.focus();b.click();return {active:document.activeElement.tagName,id:document.activeElement.id,hidden:!!document.activeElement.closest("[hidden]")}})()');record('Later restores focus outside hidden update panel',!laterFocus.hidden&&laterFocus.active!=='BODY',laterFocus);
 await tab.evaluate('ES.UI.go("settings")');await new Promise(r=>setTimeout(r,60));
 await tab.evaluate('document.querySelector("#setOffline").focus();document.querySelector("#setOffline").click()');
 await until(()=>tab.evaluate('!document.querySelector(".offline-status").hidden'),'settings updates notice');
 await tab.evaluate('[...document.querySelectorAll(".offline-status button")].find(b=>b.textContent==="Save Recovery").focus()');
 await tab.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await tab.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 record('keyboard Tab reaches Later',await tab.evaluate('document.activeElement.textContent==="Later"'));
 await tab.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await tab.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 record('Settings Later returns keyboard focus to Offline and Updates',await tab.evaluate('document.activeElement.id==="setOffline"&&document.querySelector(".offline-status").hidden'));
 await tab.evaluate('ES.Offline.check();ES.UI.go("home");[...document.querySelectorAll(".offline-status button")].find(b=>b.textContent==="Later").focus();ES.Offline.defer()');await new Promise(r=>setTimeout(r,80));
 record('navigation during notice dismissal cannot focus obsolete Settings',await tab.evaluate('!document.activeElement.closest("[hidden],[inert]")&&!!document.querySelector("#scr-home").contains(document.activeElement)'));
 await tab.evaluate('ES.Offline.check();ES.UI.saveRecovery();self.auditDialogFocus=document.activeElement;ES.Offline.defer()');
 record('Later respects active Save Recovery modal focus',await tab.evaluate('document.activeElement===auditDialogFocus&&!!document.activeElement.closest("[role=dialog]")'));
 await tab.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await tab.evaluate(`caches.open(${JSON.stringify(cache)}).then(c=>c.delete(${JSON.stringify(origin+release.base+'js/engine.js')}))`);
 const incomplete=await tab.evaluate(rpc({type:'STATUS'}));await tab.evaluate('ES.Offline.check();true');await tab.evaluate('ES.Offline.downloadAll()');const message=await tab.evaluate('document.querySelector(".offline-status").textContent');const still=await tab.evaluate(rpc({type:'STATUS'}));
 record('optional download never claims complete offline modes while core is missing',!incomplete.ok&&!still.ok&&still.artworkOk===true&&message.includes('Artwork downloaded.')&&message.includes('Repair offline files')&&!message.includes('available offline'),{before:incomplete,after:still,message});await shot(tab,'partial-eviction-message');
 networkOnline=false;
 const missingCore=await tab.evaluate(`fetch(${JSON.stringify(origin+release.base+'js/engine.js')},{cache:'no-store'}).then(r=>r.status)`);
 record('partial eviction actually prevents offline core loading',missingCore===503,{status:missingCore});
 networkOnline=true;
 await tab.evaluate('ES.Offline.repair()');const repaired=await tab.evaluate(rpc({type:'STATUS'}));const readyMessage=await tab.evaluate('document.querySelector(".offline-status").textContent');
 record('explicit core repair confirms current release and all artwork readiness',repaired.ok&&repaired.artworkOk&&repaired.id===release.id&&readyMessage.includes('all supported modes and artwork'),{repaired,readyMessage});
 const spectator=await chrome.tab();await spectator.navigate(base+'?screen=settings');await until(()=>spectator.evaluate('ES?.UI?.current==="settings"&&!!navigator.serviceWorker.controller'),'spectator settings');
 await spectator.evaluate('document.querySelector("#setOffline").click();ES.Offline.downloadAll()');
 record('read-only spectator can inspect and download offline capabilities',await spectator.evaluate('!ES.Store.canEdit&&!document.querySelector(".offline-status").hidden&&document.querySelector(".offline-status").textContent.includes("all supported modes and artwork")'));
 await spectator.evaluate('[...document.querySelectorAll(".offline-status button")].find(b=>b.textContent==="Save Recovery").click()');
 record('spectator update panel preserves Save Recovery exports',await spectator.evaluate('!!document.querySelector("#saveStored")&&!!document.querySelector("#saveExport")&&document.activeElement.closest("[role=dialog]")!==null'));
 await spectator.close();
 const failureEvents=chrome.events.filter(e=>e.method==='Runtime.exceptionThrown');errors.push(...failureEvents.map(e=>e.params.exceptionDetails));
 failedRequests.push(...requests.filter(x=>x.status>=400));
 const downloaded=(await import('node:fs')).readdirSync(out).filter(f=>f.endsWith('.json')&&f.startsWith('ember'));
 writeFileSync(resolve(out,'summary.json'),JSON.stringify({date:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),release:release.id,browser,checks,labs,install:{ms:installMs,quota},errors,failedRequests,requests,downloaded,profile:chrome.profile},null,2));
 console.log('Audit probes complete: '+checks.filter(c=>c.status==='PASS').length+' PASS, '+checks.filter(c=>c.status==='FAIL').length+' FAIL observations.');
}catch(error){let state;try{state=await page.evaluate('({hidden:document.hidden,screen:ES?.UI?.current,motion:ES?.FX?.motion(),reduced:ES?.Store?.state.settings.reduced,draws:self.audit?.draws,opacity:document.querySelector("#emberField")?.style.opacity,active:document.activeElement?.outerHTML.slice(0,300)})')}catch{}writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.stack,state,checks,errors},null,2));try{await shot(page,'failure')}catch{}console.error(error);process.exitCode=1;}
finally{await motionChrome?.close();await chrome?.close();server.close();}
