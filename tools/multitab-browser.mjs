// P4-01 release gate: real Web Locks, localStorage and multiple actual Chrome tabs.
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {readTree,root} from './verify-source.mjs';
import {chromeAudit,until} from './chrome-audit.mjs';
const out=resolve(root,'.phase2-backup/phase4-1/multitab');mkdirSync(out,{recursive:true});
const files=readTree(resolve(root,'dist')),checks=[];
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=u.pathname.slice(1)+(u.pathname.endsWith('/')?'index.html':'');const b=files.get(p);res.writeHead(b?200:404,{'Cache-Control':'no-store','Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'})[extname(p)]||'application/json'});res.end(b||'Not found')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/ember-solitaire/';let chrome,a,b;
const check=(name,ok,detail)=>{checks.push({name,pass:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+' '+JSON.stringify(detail))};
const boot=tab=>until(()=>tab.evaluate('!!window.ES?.Store&&ES.UI.current==="home"'),'boot',30000);
const raw=tab=>tab.evaluate('({main:localStorage.getItem(ES.Store.KEY),backup:localStorage.getItem(ES.Store.BACKUP_KEY)})');
const shot=async(tab,name)=>writeFileSync(resolve(out,name+'.png'),Buffer.from((await tab.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
try{
 chrome=await chromeAudit();const browser=await chrome.send('Browser.getVersion');a=await chrome.tab();await a.navigate(base+'?nosw&screen=home');await boot(a);
 check('A holds an actual exclusive Web Lock',await a.evaluate('ES.Store.canEdit&&ES.Store.ownership==="writer"'));
 b=await chrome.tab();await b.navigate(base+'?nosw&screen=home');await boot(b);
 check('B is read-only, with a visible warning and export/recovery access',await b.evaluate('!ES.Store.canEdit&&ES.Store.persistence.blocked&&!document.querySelector(".save-status").hidden&&document.querySelector(".save-status").textContent.includes("Read-only")'));
 await a.evaluate('ES.Store.state.ftue.intro=true;ES.Store.addEmber(100,"audit");ES.Store.save(true)');const earned=await raw(a);
 check('A durably saves 100 Ember',JSON.parse(earned.main).totalEmber===100);
 const refused=await b.evaluate('ES.Store.state.settings.music=0;ES.Store.save(true)');check('stale B cannot replace primary or backup',refused===false&&JSON.stringify(await raw(b))===JSON.stringify(earned),{before:earned,after:await raw(b)});
 check('refused B never reports saved',await b.evaluate('ES.Store.persistence.code!=="saved"&&ES.Store.persistence.unsaved'));
 await b.evaluate('ES.UI.saveRecovery()');check('read-only recovery includes stored export and explicit ownership-resolution control',await b.evaluate('!!document.querySelector("#saveStored")&&!!document.querySelector("#saveResume")'));await shot(b,'readonly-recovery');
 await b.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await a.evaluate('const g=ES.Engine.newGame(2,{seed:42});ES.Store.startGame(g);ES.Store.save(true)');const hand=await raw(a);
 check('background visibility flush cannot erase active hand',await b.evaluate('document.dispatchEvent(new Event("visibilitychange"));ES.Store.save(true)')===false&&JSON.stringify(await raw(b))===JSON.stringify(hand));
 check('read-only new game, rewards, import and reset are refused',await b.evaluate('(()=>{const before=JSON.stringify(ES.Store.state);const g=ES.Engine.newGame(1);return ES.Store.startGame(g)===false&&ES.Store.addEmber(10)===false&&ES.Store.reset()===false&&ES.Store.importSave(\'{"v":2,"embers":1}\')===false&&JSON.stringify(ES.Store.state)===before})()'));
 check('B cannot steal ownership from A',await b.evaluate('ES.Store.resumeEditing()')===false);
 // Bypass the cooperating API to model a legacy/external writer. Current writer
 // must protect the raw value at the synchronous replacement boundary.
 const future='{"v":99,"savedAt":9999999999999,"futureProgress":"keep original"}';
 await b.evaluate(`localStorage.setItem(ES.Store.KEY,${JSON.stringify(future)})`);await until(()=>a.evaluate('ES.Store.persistence.code==="conflict"'),'storage conflict');
 check('already-running A refuses an external future-schema raw value',await a.evaluate('ES.Store.save(true)')===false&&(await raw(a)).main===future&&(await raw(a)).backup===hand.backup);
 check('future raw and local session retained as recovery copies',await a.evaluate(`ES.Store.recoveryCopies().some(k=>ES.Store.exportRecovery(k)===${JSON.stringify(future)})&&!!ES.Store.conflictMemory`));await shot(a,'future-conflict');
 // Restore the exact valid hand through explicit user-confirmed recovery import.
 await b.evaluate(`localStorage.setItem(ES.Store.KEY,${JSON.stringify(hand.main)})`);
 check('A explicitly resolves conflict by preserving memory and loading current raw',await a.evaluate('ES.Store.resumeEditing()'));
 const recoveryCount=await a.evaluate('ES.Store.recoveryCopies().length');
 await a.close();await until(()=>b.evaluate('ES.Store.acquireWriter()'),'successor lock');
 check('acquired successor cannot save before loading latest progress',await b.evaluate('ES.Store.save(true)')===false);
 await b.evaluate('ES.UI.saveRecovery();document.querySelector("#saveResume").click();document.querySelectorAll(".overlay:last-child [data-i]")[1].click()');
 await until(()=>b.evaluate('ES.Store.canEdit&&ES.UI.current==="home"&&!ES.UI.hasModal()'),'confirmed UI ownership resolution');
 check('B explicitly resumes the current hand through the recovery UI',await b.evaluate('ES.Store.state.totalEmber===100&&ES.Store.state.game.suits===2&&ES.Store.canEdit'));
 check('successor retains earlier recovery copies',await b.evaluate('ES.Store.recoveryCopies().length')>=recoveryCount);
 await b.evaluate('ES.Store.save(true)');const beforeReload=await raw(b);await b.call('Page.reload');await boot(b);
 check('writer reload reacquires and preserves hand/currency',await b.evaluate('ES.Store.canEdit&&ES.Store.state.totalEmber===100&&ES.Store.state.game.suits===2'));
 // Native target crash releases the real browser-owned lock without an app callback.
 const c=await chrome.tab();await c.navigate(base+'?nosw&screen=home');await boot(c);const crashed=b.call('Page.crash').catch(()=>{});
 await until(()=>c.evaluate('ES.Store.acquireWriter()'),'crash releases real lock',30000);check('writer crash releases ownership for explicit successor',await c.evaluate('ES.Store.resumeEditing()')&&await c.evaluate('ES.Store.state.totalEmber===100'));void crashed;
 // A separate partition models missing coordination APIs; source has no bypass.
 const context=await chrome.send('Target.createBrowserContext'),unsupported=await chrome.tab(context.browserContextId);
 await unsupported.call('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"locks",{value:undefined})'});await unsupported.navigate(base+'?nosw&screen=home');await boot(unsupported);
 check('unsupported Locks fails closed visibly with no authoritative save',await unsupported.evaluate('!ES.Store.canEdit&&ES.Store.ownership==="unsupported"&&ES.Store.save(true)===false&&localStorage.getItem(ES.Store.KEY)===null&&!document.querySelector(".save-status").hidden'));
 await shot(unsupported,'unsupported');await chrome.send('Target.disposeBrowserContext',context);
 // Verify a real terminal fixture still settles once while the successor owns.
 await c.call('Page.bringToFront');
 const payout=await c.evaluate(`(()=>{const g=ES.Engine.newGame(1,{seed:42}),cards=ES.Engine.newDeck(1,()=>0).filter(x=>parseInt(x.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);cards.forEach(x=>x.up=true);g.cols=[cards.slice(0,12),[cards[12]],...Array.from({length:8},()=>[])];g.stock=[];g.completed=g.bestCompleted=7;ES.Store.startGame(g);ES.UI.go('game');ES.Board.start(g);const before=ES.Store.state.stats.wins;ES.Board.doMove(1,0,0);ES.Board.doUndo();ES.Board.doMove(1,0,0);ES.Store.save(true);return {delta:ES.Store.state.stats.wins-before,paid:ES.Store.state.game.settlement.victoryPaid,status:ES.Store.persistence.code}})()`);
 check('victory replay settles exactly once under real ownership',payout.delta===1&&payout.paid&&payout.status==='saved',payout);
 writeFileSync(resolve(out,'summary.json'),JSON.stringify({date:new Date().toISOString(),browser,checks,release:JSON.parse(files.get('ember-solitaire/release.json')).id,beforeReload,profile:chrome.profile},null,2));console.log(checks.length+' two-tab browser checks passed');
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:error.stack,checks},null,2));console.error(error);process.exitCode=1;}
finally{await chrome?.close();server.close();server.closeAllConnections();}
