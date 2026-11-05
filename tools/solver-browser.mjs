// Phase 4.3: real Board-path search responsiveness and failure/lifecycle probes.
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {readTree,root} from './verify-source.mjs';
import {chromeAudit,until} from './chrome-audit.mjs';
const out=resolve(root,process.env.HFS_SOLVER_EVIDENCE||'.phase2-backup/solver-browser');mkdirSync(out,{recursive:true});
const files=readTree(resolve(root,'dist')),release=JSON.parse(files.get('ember-solitaire/release.json')),checks=[],measurements=[];
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname.slice(1)+(req.url.split('?')[0].endsWith('/')?'index.html':'');const b=files.get(p);res.writeHead(b?200:404,{'Cache-Control':'no-store','Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'})[extname(p)]||'application/json'});res.end(b||'Not found')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/ember-solitaire/';let chrome,tab;
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name+' '+JSON.stringify(detail))};
const probe=`self.searchAudit={calls:0,workers:[],long:[]};new PerformanceObserver(l=>searchAudit.long.push(...l.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
self.NativeSearchWorker=Worker;self.Worker=class extends NativeSearchWorker{constructor(url,...args){if(self.searchFault==='init')throw Error('Injected initialization failure');const requested=new URL(url,document.baseURI).href;if(self.searchFault==='crash'||self.searchFault==='hang')url=URL.createObjectURL(new Blob([self.searchFault==='crash'?'throw Error("Injected worker crash")':'self.onmessage=()=>{}'],{type:'text/javascript'}));super(url,...args);const record=this.record={requested,worker:this,requests:[],replies:[],terminated:false};searchAudit.workers.push(record);this.addEventListener('message',e=>record.replies.push(e.data));}postMessage(d,...args){this.record.requests.push(structuredClone(d));return super.postMessage(d,...args)}terminate(){this.record.terminated=true;super.terminate()}};`;
const finalFixture=`(()=>{const g=ES.Engine.newGame(1,{seed:42}),c=ES.Engine.newDeck(1,()=>0).filter(c=>parseInt(c.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);c.forEach(c=>c.up=true);g.cols=[c.slice(0,11),[c[11]],[c[12]],...Array.from({length:7},()=>[])];g.stock=[];g.completed=g.bestCompleted=7;return g})()`;
const stressFixture=`(()=>{const g=ES.Engine.newGame(4,{seed:42});while(g.stock.length)ES.Engine.deal(g);g.cols.flat().forEach(c=>c.up=true);g.history=[];return g})()`;
const reachableFixture=`(()=>{const g=ES.Engine.newGame(2,{seed:42});for(let n=0;n<40&&!g.won;n++){const m=ES.Engine.hintBasic(g);if((n%7===6||!m)&&ES.Engine.canDeal(g).ok)ES.Engine.deal(g);else if(m)ES.Engine.move(g,m.from,m.idx,m.to);else break;}return g})()`;
const start=async(fixture=finalFixture)=>{
 await tab.evaluate(`ES.Board.pause(true);self.testGame=${fixture};ES.Store.validateHand(testGame);ES.Store.state.settings.reduced=true;ES.Store.startGame(testGame);ES.UI.go('game');ES.Board.start(testGame);self.searchStart=performance.now();self.searchWorkerStart=searchAudit.workers.length;true`);
};
const status=()=>tab.evaluate('ES.Board.searchStatus');
const waitState=state=>until(()=>status().then(s=>s?.state===state),state,12000);
try{
 chrome=await chromeAudit();const browser=await chrome.send('Browser.getVersion');tab=await chrome.tab();await tab.call('Page.addScriptToEvaluateOnNewDocument',{source:probe});await tab.navigate(base+'?nosw&screen=home');await tab.call('Page.bringToFront');await until(()=>tab.evaluate('ES?.UI?.current==="home"'),'boot');
 await tab.evaluate(`self.oldSolve=ES.Engine.solveEndgame;self.oldStuck=ES.Engine.isStuck;ES.Engine.solveEndgame=()=>{searchAudit.calls++;throw Error('Main-thread planner forbidden')};ES.Engine.isStuck=()=>{searchAudit.calls++;throw Error('Main-thread stuck search forbidden')}`);
 for(const cpu of [1,4]){
  await tab.call('Emulation.setCPUThrottlingRate',{rate:cpu});
  for(const [name,fixture]of [['stress-seed42',stressFixture],['canonical-near-win',finalFixture],['reachable-legal40',reachableFixture]]){
   // Warm the identical position's artwork/layout before isolating search cost.
   await start(fixture);await new Promise(r=>setTimeout(r,900));
   await start(fixture);
   const frames=await tab.evaluate(`new Promise(resolve=>{const gaps=[],begin=performance.now();let last=begin;function tick(t){gaps.push(t-last);last=t;if(t-begin<1800)requestAnimationFrame(tick);else resolve({max:Math.max(...gaps),over50:gaps.filter(g=>g>50).length,samples:gaps.length})}requestAnimationFrame(tick)})`);
   if(name==='stress-seed42')await until(()=>status().then(s=>s&&s.state!=='searching'),'stress result',10000);
   if(name==='canonical-near-win')await waitState('solved');
   const sample=await tab.evaluate(`({status:ES.Board.searchStatus,calls:searchAudit.calls,long:searchAudit.long.filter(x=>x.start>=searchStart),workers:searchAudit.workers.slice(searchWorkerStart).map(w=>({url:w.requested,requests:w.requests.map(r=>({id:r.id,type:r.type,session:r.session,revision:r.revision,workEpoch:r.workEpoch})),replies:w.replies.map(r=>({id:r.id,status:r.status,type:r.type,elapsedMs:r.elapsedMs})),terminated:w.terminated})),position:{stock:testGame.stock.length,completed:testGame.completed,faceDown:testGame.cols.flat().filter(c=>!c.up).length}})`);
   measurements.push({cpu,name,frames,...sample});check(cpu+'x '+name+' leaves main thread search-free',sample.calls===0,{frames,status:sample.status,long:sample.long});
   if(name==='stress-seed42')check(cpu+'x hard search reports its bounded no-plan result',sample.workers.flatMap(w=>w.replies).filter(r=>r.type==='endgame').at(-1)?.status==='no-plan-within-budget'&&await tab.evaluate('document.querySelector("#btnFinish").hidden'));
   if(name==='canonical-near-win')check(cpu+'x valid worker plan is offered without executing it',await tab.evaluate('!document.querySelector("#btnFinish").hidden&&testGame.moves===0&&ES.Store.state.stats.wins===0'));
  }
 }
 await tab.call('Emulation.setCPUThrottlingRate',{rate:1});
 for(const fault of ['init','crash','hang']){
  await tab.evaluate('self.searchFault='+JSON.stringify(fault));await start();await waitState(fault==='hang'?'timeout':'unavailable');
  check(fault+' failure keeps Finish hidden and manual play available',await tab.evaluate('(()=>{const safe=document.querySelector("#btnFinish").hidden&&searchAudit.calls===0;return safe&&ES.Board.doMove(1,0,0)&&ES.Store.state.stats.wins===0})()'));
 }
 await tab.evaluate('self.searchFault=null');
 for(const operation of ['restart','navigation','undo-alternate','pause','abandon']){
  // A native worker that intentionally never replies makes cancellation timing deterministic.
  await tab.evaluate('self.searchFault="hang"');await start();await waitState('searching');
  await tab.evaluate('self.oldRecord=searchAudit.workers.at(-1);self.oldReply=oldRecord.worker.onmessage;self.oldRequest=oldRecord.requests[0];self.searchFault=null');
  if(operation==='restart')await start(reachableFixture);
  if(operation==='navigation')await tab.evaluate('ES.UI.go("home")');
  if(operation==='undo-alternate')check('undo then alternate legal move retains the same move counter',await tab.evaluate('ES.Board.doMove(1,0,0)&&ES.Board.doUndo()===undefined&&ES.Board.doMove(1,0,3)&&testGame.moves===1'));
  if(operation==='pause')await tab.evaluate('ES.Board.pause(true)');
  if(operation==='abandon')await tab.evaluate('ES.Store.abandonGame()');
  const result=await tab.evaluate(`(()=>{const position=()=>JSON.stringify({game:ES.Store.state.game&&{cols:ES.Store.state.game.cols,stock:ES.Store.state.game.stock,moves:ES.Store.state.game.moves,completed:ES.Store.state.game.completed,settlement:ES.Store.state.game.settlement},embers:ES.Store.state.embers,totalEmber:ES.Store.state.totalEmber,wins:ES.Store.state.stats.wins});const before=position(),raw=localStorage.getItem(ES.Store.KEY),backup=localStorage.getItem(ES.Store.BACKUP_KEY),wins=ES.Store.state.stats.wins;oldReply({data:{...oldRequest,status:'solved',plan:[{from:1,idx:0,to:0}]}});return {same:before===position()&&raw===localStorage.getItem(ES.Store.KEY)&&backup===localStorage.getItem(ES.Store.BACKUP_KEY),wins:ES.Store.state.stats.wins===wins,terminated:oldRecord.terminated,hidden:document.querySelector('#btnFinish').hidden}})()`);
  check(operation+' terminates obsolete worker and rejects a queued late callback',result.same&&result.wins&&result.terminated&&result.hidden,result);
 }
 await tab.evaluate('self.searchFault="hang"');await start();await waitState('searching');
 await tab.evaluate('ES.Board.pause(false);ES.Board.pause(false)');await waitState('searching');
 check('rapid checks never have more than one live worker',await tab.evaluate('searchAudit.workers.filter(w=>!w.terminated).length===1'));
 await tab.evaluate('ES.Store.save(true)');const spectator=await chrome.tab();await spectator.call('Page.addScriptToEvaluateOnNewDocument',{source:probe});await spectator.navigate(base+'?nosw&screen=home');await until(()=>spectator.evaluate('ES?.UI?.current==="home"'),'spectator');
 await spectator.evaluate('ES.Screens.resumeGame()');await new Promise(r=>setTimeout(r,800));
 check('read-only secondary tab cannot request planning or execute Finish',await spectator.evaluate('!ES.Store.canEdit&&searchAudit.workers.length===0&&document.querySelector("#btnFinish").hidden'));
 await spectator.close();await tab.evaluate('ES.Board.pause(true);self.searchFault=null');await start();await waitState('solved');
 await tab.evaluate('document.querySelector("#btnFinish").click()');await until(()=>tab.evaluate('ES.Store.state.game.won'),'worker plan victory');
 check('current plan executes legal steps and settles victory once',await tab.evaluate('ES.Store.state.stats.wins===1&&ES.Store.state.game.settlement.victoryPaid'));
 check('all browser scenarios have zero synchronous engine searches',await tab.evaluate('searchAudit.calls===0'));
 await tab.evaluate('ES.UI.go("home")');check('navigation releases every remaining worker',await tab.evaluate('searchAudit.workers.every(w=>w.terminated)'));
 writeFileSync(resolve(out,'summary.json'),JSON.stringify({date:new Date().toISOString(),release:release.id,browser,checks,measurements},null,2));console.log(checks.length+' solver browser checks passed');
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:error.stack,checks,measurements},null,2));try{writeFileSync(resolve(out,'failure.png'),Buffer.from((await tab.call('Page.captureScreenshot',{format:'png'})).data,'base64'))}catch{}console.error(error);process.exitCode=1;}
finally{await chrome?.close();server.close();server.closeAllConnections();}
