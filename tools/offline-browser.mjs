// Release-blocking same-origin deployment-switch audit, separate from node --test.
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {generate} from './release.mjs';
import {readTree,root,hash,archiveFiles} from './verify-source.mjs';
import {chromeAudit,until} from './chrome-audit.mjs';
const out=resolve(root,process.env.HFS_OFFLINE_EVIDENCE||'.phase2-backup/phase3f-browser');mkdirSync(out,{recursive:true});
const source=readTree(resolve(root,'site'));
function variant(label) {
 const input=new Map(source);
 input.set('ember-solitaire/js/offline.js',Buffer.from(input.get('ember-solitaire/js/offline.js').toString().replace('worker.postMessage(data, [channel.port2]);','(root.__auditRPC ||= []).push({data,state:worker.state});worker.postMessage(data, [channel.port2]);').replace('channel.port1.onmessage = event => {','channel.port1.onmessage = event => { (root.__auditReplies ||= []).push(event.data);')));
 input.set('ember-solitaire/js/engine.js',Buffer.concat([input.get('ember-solitaire/js/engine.js'),Buffer.from('\nself.__engineRelease='+JSON.stringify(label)+';\n')]));
 input.set('ember-solitaire/js/stuck-worker.js',Buffer.concat([input.get('ember-solitaire/js/stuck-worker.js'),Buffer.from('\nself.postMessage=(original=>data=>original({...data,engineRelease:self.__engineRelease}))(self.postMessage.bind(self));\n')]));
 input.set('ember-solitaire/css/board.css',Buffer.concat([input.get('ember-solitaire/css/board.css'),Buffer.from('\n:root{--audit-release:'+label+';}\n')]));
 return generate(input);
}
const A=variant('A'),B=variant('B'),C=variant('C'),D=variant('D');
const legacy=new Map(source);legacy.delete('ember-solitaire/js/offline.js');
// Recreate the pre-protocol registration and unversioned shell without relying
// on mutable Git HEAD (the harness must still work after this change is committed).
legacy.set('ember-solitaire/index.html',Buffer.from(source.get('ember-solitaire/index.html').toString().replace(/^[^\n]*<script src="js\/offline\.js"[^\n]*\n/m,'')));
legacy.set('ember-solitaire/js/app.js',Buffer.from(source.get('ember-solitaire/js/app.js').toString().replace('if (ES.Offline) ES.Offline.start();',"if ('serviceWorker' in navigator && !root.Capacitor && /^https?:/.test(location.protocol) && !/[?&]nosw/.test(location.search)) navigator.serviceWorker.register('sw.js').catch(() => {});")));
// Use the authoritative archived pre-3F worker, not a simulated replacement.
legacy.set('ember-solitaire/sw.js',archiveFiles(readFileSync(resolve(root,'site-source.tar.gz'))).get('dist/ember-solitaire/sw.js'));
let deployed=A.output,network=true;const faults=new Map(),requests=[],checks=[];
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname).replace(/^\//,'')+(url.pathname.endsWith('/')?'index.html':'');
 const fault=faults.get(path);
 if(!network||fault==='abort'){requests.push({path,status:'aborted'});res.destroy();return;}
 const bytes=deployed.get(path);const status=typeof fault==='number'?fault:bytes?200:404;
 requests.push({path,status,sha256:bytes?hash(bytes):null});
 res.writeHead(status,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png'})[extname(path)]||'text/plain','Cache-Control':'no-store'});
 res.end(status===200?bytes:'Injected unavailable resource');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,base=origin+'/ember-solitaire/';let chrome, auditPage;
const check=(name,condition,detail)=>{checks.push({name,pass:!!condition,detail});console.log((condition?'PASS ':'FAIL ')+name);if(!condition)throw Error(name+': '+JSON.stringify(detail));};
const rpc=(data,which='controller')=>`(async()=>{const worker=${which==='controller'?'navigator.serviceWorker.controller':which};return new Promise((resolve,reject)=>{const c=new MessageChannel(),t=setTimeout(()=>reject(Error('RPC timeout')),10000);c.port1.onmessage=e=>{clearTimeout(t);c.port1.close();resolve(e.data)};worker.postMessage(${JSON.stringify(data)},[c.port2])});})()`;
async function boot(tab,id) {await until(()=>tab.evaluate(`window.ES?.Offline?.id===${JSON.stringify(id)}&&ES.UI?.current==='home'`),'boot '+id.slice(0,8),30000);}
async function ready(tab,id) {await until(()=>tab.evaluate(`!!navigator.serviceWorker.controller&&new URL(navigator.serviceWorker.controller.scriptURL).searchParams.get('emberProtocol')==='1'&&${rpc({type:'STATUS'})}.then(s=>s.ok&&s.id===${JSON.stringify(id)})`),'installed core',35000);}
async function screenshot(tab,name){const r=await tab.call('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(out,name+'.png'),Buffer.from(r.data,'base64'));}
const progress=tab=>tab.evaluate('(()=>{const s=ES.Store.state,g=s.game;return {embers:s.embers,totalEmber:s.totalEmber,wins:s.stats.wins,hand:g?.settlement.handId,cols:g?.cols,stock:g?.stock,moves:g?.moves};})()');
async function identities(tab,release,label){
 const details=await tab.evaluate(`(async()=>{const expected=${JSON.stringify(release.files)},base=${JSON.stringify(release.base)};const urls=[...document.scripts].map(s=>s.src).concat([...document.querySelectorAll('link[rel=stylesheet]')].map(s=>s.href));const results=[];for(const url of urls){const p=new URL(url).pathname;if(!p.startsWith(base))return {ok:false,bad:url};const f=expected.find(f=>base+f.path===p),r=await fetch(url),b=await r.arrayBuffer(),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');results.push({path:p,sha256:h,ok:r.ok&&f?.sha256===h});}return {ok:results.every(x=>x.ok),engine:self.__engineRelease,css:getComputedStyle(document.documentElement).getPropertyValue('--audit-release').trim(),results};})()`);
 check('actual loaded '+label+' scripts and CSS identities',details.ok&&details.engine===label&&details.css===label,details);
 const worker=await tab.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(new URL('js/stuck-worker.js',document.baseURI));w.onmessage=e=>{w.terminate();resolve(e.data)};w.onerror=e=>reject(Error(e.message));w.postMessage({id:9,session:8,revision:7,cols:ES.Store.state.game.cols,stock:ES.Store.state.game.stock,completed:ES.Store.state.game.completed});})`);
 check('dedicated worker imports '+label+' engine',worker.engineRelease===label&&worker.id===9&&worker.revision===7,worker);
 const plan=await tab.evaluate(`new Promise((resolve,reject)=>{const w=new Worker(new URL('js/stuck-worker.js',document.baseURI)),cards=ES.Engine.newDeck(1,()=>0).filter(c=>parseInt(c.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);cards.forEach(c=>c.up=true);const cols=[cards.slice(0,12),[cards[12]],...Array.from({length:8},()=>[])];const timer=setTimeout(()=>{w.terminate();reject(Error('Offline endgame timeout'))},8000);w.onmessage=e=>{clearTimeout(timer);w.terminate();resolve(e.data)};w.onerror=e=>{clearTimeout(timer);w.terminate();reject(Error(e.message))};w.postMessage({type:'endgame',id:10,session:8,revision:7,workEpoch:6,cols,stock:[],completed:7});})`);
 check('offline-capable endgame worker uses '+label+' immutable engine',plan.engineRelease===label&&plan.type==='endgame'&&plan.id===10&&plan.workEpoch===6&&plan.status==='solved'&&plan.plan.length===1,plan);
}
try {
 chrome=await chromeAudit();const browser=await chrome.send('Browser.getVersion');writeFileSync(resolve(out,'browser.json'),JSON.stringify(browser,null,2));
 const a=await chrome.tab();auditPage=a;await a.call('ServiceWorker.enable');await a.navigate(base+'?screen=home');await boot(a,A.release.id);await ready(a,A.release.id);
 await a.evaluate('ES.Offline.defer();ES.Store.state.ftue.intro=true;ES.Store.state.settings.reduced=true;ES.Store.state.embers=321;const g=ES.Engine.newGame(1,{seed:42});ES.Store.startGame(g);ES.UI.go("game");ES.Board.start(g);ES.Store.save(true);');
 check('fresh online A core installed',true,{release:A.release.id,coreFiles:A.release.files.filter(f=>f.core).length});
 await identities(a,A.release,'A');
 const skip=await a.evaluate('(()=>{const before=location.href;document.querySelector(".skip-board").click();return location.href===before&&document.activeElement.id==="board"})()');
 check('release base preserves local keyboard skip navigation',skip);
 network=false;await a.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await a.call('Page.reload');await boot(a,A.release.id);await a.evaluate('ES.Screens.resumeGame();ES.Offline.defer()');
 const offline=await a.evaluate(`Promise.all(${JSON.stringify(A.release.files.filter(f=>f.core).map(f=>origin+A.release.base+f.path))}.map(async url=>{const r=await fetch(url);await r.arrayBuffer();return r.status===200})).then(a=>a.every(Boolean))`);
 check('A reload offline and all promised core resources',offline);await screenshot(a,'a-offline');
 await a.evaluate('ES.UI.go("modes")');await until(()=>a.evaluate('[...document.querySelectorAll(".fan img")].every(i=>i.complete&&i.naturalWidth>0)'),'offline mode-picker images');
 check('offline mode picker retains its complete preview artwork',true);await a.evaluate('ES.Screens.resumeGame()');
 const privacy=await chrome.tab();await privacy.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await privacy.navigate(base+'index.html?screen=home');await boot(privacy,A.release.id);check('offline index.html alias launches the same A release',true);await privacy.navigate(base+'privacy.html');await until(()=>privacy.evaluate('document.querySelector("h1")?.textContent.includes("Privacy")'),'offline privacy');check('offline privacy is its own document',await privacy.evaluate('!document.querySelector("#board")'));await privacy.navigate(base+'unknown-route');await until(()=>privacy.evaluate('document.body.textContent.includes("does not exist")'),'unknown offline navigation');check('unknown offline route does not masquerade as game',true);await privacy.close();
 network=true;await a.call('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 const old=await chrome.tab();await old.navigate(base+'?screen=home');await boot(old,A.release.id);await old.evaluate('ES.Offline.defer()');
 await a.evaluate('caches.open("hfs-unrelated-audit").then(c=>c.put("/unrelated",new Response("keep")))');
 deployed=B.output;faults.set('ember-solitaire'+B.release.base.slice('/ember-solitaire'.length)+'assets/cards/hearts/ace.webp',404);
 await a.evaluate('ES.Offline.check()');await until(()=>a.evaluate(`ES.Offline.target===${JSON.stringify(B.release.id)}`),'B detected by A',35000);
 check('B installation tolerates missing optional artwork',true);check('A game unchanged while B waits',await a.evaluate('self.__engineRelease==="A"&&!!ES.Store.state.game'));
 await a.call('Page.bringToFront');await until(()=>a.evaluate('!document.hidden'),'A foreground input ownership');
 await a.evaluate('ES.Offline.defer();const m=ES.Engine.hintBasic(ES.Store.state.game);ES.Board.doMove(m.from,m.idx,m.to);');check('deferred A remains playable',await a.evaluate('ES.Store.state.game.moves===1'));
 await a.evaluate('self.auditSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("Injected","QuotaExceededError")};');
 check('failed save blocks real-browser update approval',await a.evaluate('ES.Offline.approve()')===false&&await a.evaluate('self.__engineRelease==="A"'));
 await screenshot(a,'update-save-blocked');await a.evaluate('Storage.prototype.setItem=self.auditSet;ES.Store.save(true)');const saved=await progress(a);
 await a.evaluate('void ES.Offline.approve();true');await boot(a,B.release.id);await ready(a,B.release.id);check('same-origin safe A to B preserves hand and progression',JSON.stringify(await progress(a))===JSON.stringify(saved),{before:saved,after:await progress(a)});
 await a.evaluate('ES.Screens.resumeGame();ES.Offline.defer()');await identities(a,B.release,'B');await identities(old,A.release,'A');
 check('unapproved old tab remains A under B controller',await old.evaluate('self.__engineRelease==="A"')&&(await old.evaluate(rpc({type:'STATUS'}))).id===B.release.id);
 network=false;await a.evaluate('ES.Offline.check()');check('offline update check leaves current B running',await a.evaluate('self.__engineRelease==="B"'));network=true;
 const optional=origin+B.release.base+'assets/cards/hearts/ace.webp';
 let r=await a.evaluate(`fetch(${JSON.stringify(optional)}).then(async r=>{await r.arrayBuffer();return r.status})`);check('404 optional response is rejected',r===503,r);
 const optionalPath=new URL(optional).pathname.slice(1);faults.set(optionalPath,500);r=await a.evaluate(`fetch(${JSON.stringify(optional)}).then(async r=>{await r.arrayBuffer();return r.status})`);check('500 optional response is rejected',r===503,r);faults.delete(optionalPath);
 r=await a.evaluate(`fetch(${JSON.stringify(optional)}).then(async r=>{await r.arrayBuffer();return r.status})`);faults.set(optionalPath,500);check('successful cached asset survives later HTTP 500',r===200&&await a.evaluate(`fetch(${JSON.stringify(optional)}).then(async r=>{await r.arrayBuffer();return r.status})`)===200);faults.delete(optionalPath);
 // Real Chromium quota override. No player storage is used or cleared.
 await a.call('Storage.overrideQuotaForOrigin',{origin,quotaSize:1});
 const quota=await a.evaluate('(async()=>{try{const c=await caches.open("hfs-quota-audit");await c.put("/quota",new Response(new Uint8Array(1048576)));return "allowed"}catch(e){return e.name}})()');
 check('real browser CacheStorage quota exhaustion reproduced',quota==='QuotaExceededError',quota);
 await a.evaluate('ES.Offline.downloadAll()');check('quota failure is visible without claiming optional success',await a.evaluate('document.querySelector(".offline-status").textContent.includes("could not")'));
 await a.call('Storage.overrideQuotaForOrigin',{origin});await a.evaluate('caches.delete("hfs-quota-audit")');
 // Inject a Cache.put failure inside the actual active worker, separately labelled.
 await a.evaluate(rpc({type:'STATUS'}));const targets=await chrome.send('Target.getTargets');let attached;
 for(const target of targets.targetInfos.filter(t=>t.type==='service_worker'&&t.url.startsWith(base+'sw.js'))) {
  try {const session=await chrome.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const value=await chrome.send('Runtime.evaluate',{expression:'RELEASE.id',returnByValue:true},session.sessionId);if(value.result.value===B.release.id){attached=session;break;}}catch{}
 }
 if(!attached)throw Error('No running B worker target');
 await chrome.send('Runtime.evaluate',{expression:'self.auditPut=Cache.prototype.put;Cache.prototype.put=function(){return Promise.reject(new DOMException("Injected write failure","QuotaExceededError"))};'},attached.sessionId);
 await a.evaluate('ES.Offline.downloadAll()');check('fault-injected worker cache-write failure is visible',await a.evaluate('document.querySelector(".offline-status").textContent.includes("could not")'));
 await chrome.send('Runtime.evaluate',{expression:'Cache.prototype.put=self.auditPut;'},attached.sessionId);await a.evaluate('ES.Offline.downloadAll()');check('optional download recovers after write failures',await a.evaluate('document.querySelector(".offline-status").textContent.includes("all supported modes and artwork are available offline")'));
 const ownCache='ember-solitaire:'+encodeURIComponent(base)+':release-v1:'+B.release.id;
 await a.evaluate(`caches.open(${JSON.stringify(ownCache)}).then(c=>c.delete(${JSON.stringify(origin+B.release.base+'js/engine.js')}))`);network=false;
 const evicted=await a.evaluate(`fetch(${JSON.stringify(origin+B.release.base+'js/engine.js')}).then(async r=>{await r.arrayBuffer();return r.status})`);
 check('partial core eviction fails explicitly offline without release substitution',evicted===503);network=true;
 await a.evaluate('ES.Offline.repair()');check('partial eviction repair restores core', (await a.evaluate(rpc({type:'STATUS'}))).ok);
 const beforeEviction=await progress(a);await a.evaluate(`caches.delete(${JSON.stringify(ownCache)})`);await a.evaluate('ES.Offline.repair()');
 check('whole release-cache eviction can be repaired online', (await a.evaluate(rpc({type:'STATUS'}))).ok);
 check('cache eviction and repair never reset player progress',JSON.stringify(await progress(a))===JSON.stringify(beforeEviction));
 deployed=C.output;faults.set('ember-solitaire'+C.release.base.slice('/ember-solitaire'.length)+'js/engine.js',500);await a.evaluate('ES.Offline.check()');await until(()=>Promise.resolve(requests.some(r=>r.path===C.release.base.slice(1)+'js/engine.js'&&r.status===500)),'failed C request');await new Promise(r=>setTimeout(r,500));check('failed C core install leaves B active', (await a.evaluate(rpc({type:'STATUS'}))).id===B.release.id);faults.clear();
 deployed=D.output;faults.set(D.release.base.slice(1)+'js/engine.js','abort');await a.evaluate('ES.Offline.check()');await until(()=>Promise.resolve(requests.some(r=>r.path===D.release.base.slice(1)+'js/engine.js'&&r.status==='aborted')),'interrupted D');await new Promise(r=>setTimeout(r,600));check('interrupted D network install leaves B active',(await a.evaluate(rpc({type:'STATUS'}))).id===B.release.id);faults.clear();deployed=B.output;
 await old.close();await until(async()=>{await a.evaluate(rpc({type:'RETIRE'}));return !(await a.evaluate('caches.keys()')).some(n=>n.endsWith(A.release.id));},'A client retirement');const names=await a.evaluate('caches.keys()');check('A cache retires after its last client closes',!names.some(n=>n.endsWith(A.release.id)),names);check('unrelated application cache preserved',await a.evaluate('caches.open("hfs-unrelated-audit").then(c=>c.match("/unrelated")).then(r=>r.text())')==='keep');
 // Separate storage partition, same fixed origin for a genuine legacy -> 3F upgrade.
 const {browserContextId}=await chrome.send('Target.createBrowserContext');deployed=legacy;const legacyTab=await chrome.tab(browserContextId);await legacyTab.navigate(base+'?screen=home');await until(()=>legacyTab.evaluate('ES?.UI?.current==="home"&&!!navigator.serviceWorker.controller'),'historical worker',35000);
 await legacyTab.evaluate('ES.Store.state.ftue.intro=true;ES.Store.state.settings.reduced=true;ES.Screens.newGame(1);ES.Store.save(true);localStorage.setItem("ember.save.v2.recovery.audit","retain original")');const legacyProgress=await progress(legacyTab);
 deployed=B.output;const migrated=await chrome.tab(browserContextId);auditPage=migrated;await migrated.navigate(base+'?screen=home');await boot(migrated,B.release.id);
 await until(()=>migrated.evaluate('navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)'),'legacy installed B',35000);
 check('legacy-controlled new HTML loads B immutable engine/CSS',await migrated.evaluate('self.__engineRelease==="B"&&getComputedStyle(document.documentElement).getPropertyValue("--audit-release").trim()==="B"'));
 await migrated.evaluate('ES.Offline.check()');check('legacy active tab blocks unsafe takeover',await migrated.evaluate('ES.Offline.approve()')===false);
 await legacyTab.close();await until(()=>migrated.evaluate(rpc({type:'STATUS'},'(await navigator.serviceWorker.getRegistration()).waiting')).then(s=>s.legacyClients===0),'legacy client fully closed');
 check('legacy successor explicitly acquires saving and reloads latest progress',await migrated.evaluate('ES.Store.resumeEditing()'));
 await migrated.evaluate('ES.Offline.check()');await migrated.evaluate('void ES.Offline.approve();true');await ready(migrated,B.release.id);await boot(migrated,B.release.id);
 check('historical pre-3F upgrade preserves progress',JSON.stringify(await progress(migrated))===JSON.stringify(legacyProgress));check('historical recovery copies are never erased',await migrated.evaluate('localStorage.getItem("ember.save.v2.recovery.audit")')==='retain original');
 await identities(migrated,B.release,'B');
 await screenshot(migrated,'legacy-upgraded-b');await chrome.send('Target.disposeBrowserContext',{browserContextId});
 writeFileSync(resolve(out,'summary.json'),JSON.stringify({browser,checks,releases:{A:A.release.id,B:B.release.id,C:C.release.id,D:D.release.id},requests,profile:chrome.profile},null,2));
 console.log(checks.length+' browser checks passed');
} catch(error) {
 let diagnostic;
 try {diagnostic=await auditPage?.evaluate('(async()=>{const r=await navigator.serviceWorker.getRegistration();return {rpc:self.__auditRPC,replies:self.__auditReplies,url:location.href,id:window.ES?.Offline?.id,target:window.ES?.Offline?.target,screen:window.ES?.UI?.current,message:document.querySelector(".offline-status")?.textContent,persistence:window.ES?.Store?.persistence,active:r?.active?.state,waiting:r?.waiting?.state,body:document.body.textContent.slice(0,500),caches:await caches.keys()};})()');await screenshot(auditPage,'failure');}catch(e){diagnostic={error:e.message};}
 try {diagnostic.workers=[];for(const t of (await chrome.send('Target.getTargets')).targetInfos.filter(t=>t.type==='service_worker'&&t.url.startsWith(base+'sw.js'))) {const {sessionId}=await chrome.send('Target.attachToTarget',{targetId:t.targetId,flatten:true});const value=await chrome.send('Runtime.evaluate',{expression:'({id:RELEASE.id})',returnByValue:true},sessionId);diagnostic.workers.push(value);}}catch(e){diagnostic.workerError=e.message;}
 writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:error.stack,diagnostic,checks,requests,events:chrome?.events.filter(e=>e.method.startsWith('ServiceWorker.')||e.method==='Runtime.exceptionThrown')},null,2));throw error;
} finally {if(chrome)await chrome.close();server.close();server.closeAllConnections();}
