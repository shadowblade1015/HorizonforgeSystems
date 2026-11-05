// Optional development-only Chromium audit. Uses Node and an installed Chrome;
// never touches a player's browser profile. Output is ignored local evidence.
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, mkdtemp} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../site',import.meta.url)));
const out=resolve(process.env.HFS_MOBILE_EVIDENCE||'.phase2-backup/phase3e-browser',process.argv[2]||'after');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{let p=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+sep))throw Error();if(!extname(p))p=resolve(p,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.woff2':'font/woff2'})[extname(p)]||'application/octet-stream');res.end(process.argv[2] === 'before' ? execFileSync('git', ['show', 'HEAD:site/' + p.slice(root.length + 1).replaceAll(sep, '/')], {maxBuffer: 10000000, windowsHide: true}) : await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=await mkdtemp(resolve(tmpdir(),'ember-mobile-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-extensions','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;
const errors=[];
try{
 const endpoint=await new Promise((res,rej)=>{let s='';chrome.stderr.on('data',d=>{s+=d;const m=s.match(/DevTools listening on (ws:\/\/\S+)/);if(m)res(m[1]);});chrome.on('error',rej);setTimeout(()=>rej(Error('Chrome startup timed out')),20000).unref();});
 ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const i=++id;const timeout=setTimeout(()=>{pending.delete(i);reject(Error('CDP timeout: '+method));},15000);pending.set(i,{resolve:v=>{clearTimeout(timeout);resolve(v);},reject:e=>{clearTimeout(timeout);reject(e);}});ws.send(JSON.stringify({id:i,method,params,sessionId}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});await send('Target.activateTarget',{targetId});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId);
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const browser=await send('Browser.getVersion');await writeFile(resolve(out,'browser.json'),JSON.stringify(browser,null,2));
 await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/ember-solitaire/?nosw&screen=home`});
 for(let i=0;i<100;i++){if(await evaluate('!!window.ES?.Store?.state && ES.UI?.current === "home"'))break;await new Promise(r=>setTimeout(r,100));}
 await evaluate('ES.Store.state.settings.reduced=true; ES.UI.applySettings(); ES.UI.go("game"); const game=ES.Engine.newGame(1,{seed:42}); ES.Store.startGame(game); ES.Board.start(game); ES.Board.render({type:"none"});');
 const results=[];
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[1440,900],[667,375]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,400));await evaluate('ES.Board.render({type:"none"})');
  const geometry=await evaluate(`(()=>{const b=document.querySelector('#board'),t=document.querySelector('#table');return {cardWidth:parseFloat(b.style.getPropertyValue('--cw')),boardWidth:b.scrollWidth,tableWidth:t.clientWidth,tableHeight:t.clientHeight,boardHeight:b.scrollHeight,touchAction:getComputedStyle(b).touchAction,bodyOverflow:document.body.scrollWidth>innerWidth};})()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,`${width}x${height}.png`),Buffer.from(shot.data,'base64'));results.push({width,height,...geometry});
 }
 if(process.argv[2]!=='before') {
  const checks=[];const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});if(!pass)console.error('FAILED: '+name,detail);};
  const screenshot=async name=>{const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,name+'.png'),Buffer.from(shot.data,'base64'));};
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  await evaluate('ES.Board.render({type:"none"}); document.querySelectorAll(".a11y-col")[9].focus();');
  check('column ten reachable by keyboard focus',await evaluate('document.querySelector("#table").scrollLeft>0'));
  await screenshot('column-ten');
  await evaluate('ES.UI.saveRecovery()');
  const modal=await evaluate('(()=>{const d=document.querySelector(".overlay"),s=d.querySelector(".sheet");return {name:d.getAttribute("aria-label"),focused:d.contains(document.activeElement),background:document.querySelector("#scr-game").inert,scrollable:s.scrollHeight>s.clientHeight,height:s.clientHeight};})()');
  check('recovery named, focused, isolated and scrollable at 320px',modal.name==='Save Recovery'&&modal.focused&&modal.background&&modal.scrollable,modal);
  await screenshot('recovery-320');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  check('Escape releases modal isolation',await evaluate('!ES.UI.hasModal()&&!document.querySelector("#scr-game").inert'));
  await evaluate('ES.Screens.pauseMenu()');await screenshot('pause-320');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await call('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:true});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true});
  const drag=await evaluate(`(()=>{ES.Board.render({type:"none"});const g=ES.Store.state.game,m=ES.Engine.hintBasic(g),c=g.cols[m.from][m.idx],n=document.querySelector('.card[data-id="'+c.id+'"]'),r=n.getBoundingClientRect(),t=document.querySelectorAll(".a11y-col")[m.to].getBoundingClientRect();document.querySelector("#btnTouchMode").click();return {sx:r.left+r.width/2,sy:r.top+8,tx:t.left+t.width/2,id:c.id,to:m.to,moves:g.moves};})()`);
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:drag.sx,y:drag.sy}]});
  for(let i=1;i<=6;i++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drag.sx+(drag.tx-drag.sx)*i/6,y:drag.sy+15}]});await new Promise(r=>setTimeout(r,30));}
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('native touch drag makes exactly one legal move',await evaluate('ES.Store.state.game.moves')===drag.moves+1&&await evaluate('ES.Store.state.game.cols['+drag.to+'].some(c=>c.id==='+JSON.stringify(drag.id)+')'));
  await evaluate('document.querySelector("#btnTouchMode").click();ES.Screens.newGame(1);');
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  // Valid 45-card column: all 104 canonical cards, stock remains 50.
  await evaluate('(()=>{const g=ES.Store.state.game,c=ES.Engine.newDeck(1,()=>0);g.cols=[c.slice(0,45),...Array.from({length:9},(_,i)=>[c[45+i]])];g.stock=c.slice(54);g.cols.forEach(col=>col.forEach((x,i)=>x.up=i>=Math.min(5,col.length-1)));g.stock.forEach(x=>x.up=false);ES.Store.validateHand(g);ES.Board.render({type:"none"});const t=document.querySelector("#table");t.scrollLeft=0;t.scrollTop=0;})()');
  const deep=await evaluate('(()=>{const t=document.querySelector("#table"),b=document.querySelector("#board");return {height:b.scrollHeight,viewport:t.clientHeight,action:getComputedStyle(b).touchAction};})()');
  check('45-card board has scroll range',deep.height>deep.viewport,deep);
  await call('Emulation.setTouchEmulationEnabled',{enabled:true});
  const point=await evaluate('(()=>{const r=document.querySelector("#table").getBoundingClientRect();return {x:r.left+30,y:r.top+Math.min(160,r.height-20)};})()');
  const startMoves=await evaluate('ES.Store.state.game.moves');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let i=1;i<=5;i++) {await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-i*20}]});await new Promise(r=>setTimeout(r,30));}
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,250));
  const scrolled=await evaluate('document.querySelector("#table").scrollTop');
  check('real Chromium touch swipe scrolls without moves',scrolled>0&&await evaluate('ES.Store.state.game.moves')===startMoves,{scrollTop:scrolled});
  await evaluate('const t=document.querySelector("#table");t.scrollTop=t.scrollHeight;');await screenshot('deep-column-bottom');
  const screens=[];
  for(const name of ['splash','intro','modes','home','forge','hall','collection','daily','profile','settings']) {
   await evaluate('ES.UI.go('+JSON.stringify(name)+');');await new Promise(r=>setTimeout(r,100));
   const info=await evaluate('(()=>{const s=document.querySelector("#scr-"+ES.UI.current),f=s.querySelector(".fg");return {name:ES.UI.current,viewport:innerWidth,bodyOverflow:document.body.scrollWidth>innerWidth,height:f?.clientHeight,scrollHeight:f?.scrollHeight};})()');screens.push(info);await screenshot('screen-'+name);
  }
  await evaluate('ES.Tutorial.intro()');await screenshot('onboarding-story');await evaluate('document.querySelector("#introGo").click()');await screenshot('onboarding-choose');
  // Actual browser focus wrapping and nested restoration, not DOM-adapter results.
  await evaluate('ES.UI.go("game");document.querySelector("#btnHint").focus();window.auditParent=ES.UI.sheet({title:"Review",body:"<textarea aria-label=Notes></textarea>",actions:[{label:"Continue"}]});');
  await evaluate('const d=document.querySelector(".overlay:not([inert])");d.querySelector("button[data-i]").focus();');
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  check('native Tab wraps within the active sheet',await evaluate('document.activeElement.matches(".sheet-x")'));
  await evaluate('window.auditParentFocus=document.activeElement;window.auditChild=ES.UI.sheet({title:"Confirm",actions:[{label:"Cancel"}]});window.auditChild();');
  check('nested sheet restores parent focus',await evaluate('document.activeElement===window.auditParentFocus'));await evaluate('window.auditParent()');
  check('parent sheet restores original board control',await evaluate('document.activeElement.id==="btnHint"'));
  // Use a validated canonical last-set fixture to exercise the real ceremony.
  await evaluate('(()=>{const g=ES.Engine.newGame(1,{seed:42}),c=ES.Engine.newDeck(1,()=>0).filter(x=>parseInt(x.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);c.forEach(x=>x.up=true);g.cols=[c.slice(0,12),[c[12]],...Array.from({length:8},()=>[])];g.stock=[];g.completed=g.bestCompleted=7;ES.Store.startGame(g);ES.UI.go("game");ES.Board.start(g);ES.Board.render({type:"none"});ES.Store.validateHand(g);ES.Board.doMove(1,0,0);})()');await new Promise(r=>setTimeout(r,500));
  check('victory ceremony named, focused and isolated',await evaluate('(()=>{const e=document.querySelector(".ceremony");return e?.getAttribute("aria-label")==="Victory"&&e.contains(document.activeElement)&&document.querySelector("#scr-game").inert;})()'));await screenshot('victory-320');
  await evaluate('ES.Board.doUndo();ES.UI.go("forge");ES.Store.current().heat=1000;ES.Ceremony.strike();');await new Promise(r=>setTimeout(r,1200));await screenshot('forge-ceremony-320');
  check('forge ceremony focus reaches visible Continue',await evaluate('document.activeElement.id==="tfContinue"&&!document.activeElement.closest("[inert]")'));
  await evaluate('document.querySelector("#tfContinue")?.click();');
  for(const name of ['modes','home','forge','hall','collection','daily','profile','settings']) {
   await evaluate('document.documentElement.style.zoom="2";ES.UI.go('+JSON.stringify(name)+');');await new Promise(r=>setTimeout(r,100));await screenshot(name+'-200-percent-zoom');
  }
  const zoom=await evaluate('(()=>{const e=document.querySelector(".set-group"),r=document.querySelector(".range");return {panel:e.getBoundingClientRect().width,range:r.getBoundingClientRect().right,viewport:innerWidth};})()');check('settings range fits at 200 percent CSS zoom',zoom.range<=zoom.viewport,zoom);
  await evaluate('document.documentElement.style.zoom="1";ES.Store.state.settings.largeCards=true;ES.UI.applySettings();ES.UI.go("game");ES.Board.render({type:"none"});');await screenshot('large-cards-320');

  check('no uncaught JavaScript exceptions during browser flows',errors.length===0,errors);
  await writeFile(resolve(out,'flows.json'),JSON.stringify({checks,screens,errors},null,2));
  if(checks.some(c=>!c.pass))process.exitCode=1;
 }
 await writeFile(resolve(out,'measurements.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{ws?.close();chrome.kill();server.close();}
