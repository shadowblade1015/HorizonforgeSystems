import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {plain} from './helpers.mjs';
import {lifecycleHarness,finalHand} from './lifecycle-helpers.mjs';
const turns=async()=>{await Promise.resolve();await Promise.resolve();};

test('rapid moves use new revisions, cancel old animations and keep DOM equal to the current position',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(16);const id=g.settlement.handId;
  for(let i=0;i<4;i++){const move=h.E.hintBasic(g);assert.ok(move);const previous=h.B.capture();assert.equal(h.B.doMove(move.from,move.idx,move.to),true);assert.ok(h.B.capture().revision>previous.revision);}
  const stale=h.animations.map(a=>a.onfinish).filter(Boolean),before=plain(g.cols);h.B.doUndo();const after=plain(g.cols);assert.notDeepEqual(after,before);
  const transforms=new Map([...h.debug.B.els].map(([id,n])=>[id,n.style.transform]));stale.forEach(fn=>fn());
  assert.deepEqual(new Map([...h.debug.B.els].map(([id,n])=>[id,n.style.transform])),transforms);assert.equal(g.settlement.handId,id);
  h.clock.advance(2000);for(const [id,n]of h.debug.B.els){const c=g.cols.flat().find(c=>c.id===id);assert.ok(c);assert.equal(n.classList.contains('down'),!c.up);}
});

test('rapid stock deals apply once per accepted request and cancel obsolete flips on undo',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(16);const original=plain(g.stock);
  h.B.doDeal();h.B.doDeal();assert.equal(g.stock.length,30);assert.equal(g.moves,2);
  h.B.doUndo();assert.equal(g.stock.length,40);assert.equal(g.moves,1);h.clock.advance(2000);
  assert.equal(new Set([...g.cols.flat(),...g.stock].map(c=>c.id)).size,104);assert.equal(g.stock.length,40);assert.notDeepEqual(plain(g.stock),original);
  for(const [id,n]of h.debug.B.els)assert.equal(n.classList.contains('down'),!g.cols.flat().find(c=>c.id===id).up);
});

for(const delay of [0,100,1299])test(`undo ${delay}ms after winning cancels delayed presentation but preserves one payout`,()=>{
  const h=lifecycleHarness(),g=h.start(finalHand(h.E));h.clock.advance(16);let wins=0;h.B.onWin=()=>wins++;
  h.B.doMove(1,0,0);assert.equal(g.won,true);assert.equal(h.S.state.stats.wins,1);h.clock.advance(delay);h.B.doUndo();h.clock.advance(2000);
  assert.equal(wins,0);assert.equal(g.won,false);assert.equal(h.S.state.stats.wins,1);assert.equal(h.S.state.embers,85);assert.equal(g.settlement.victoryPaid,true);
});

test('restart before an initial frame renders cannot recreate old cards',()=>{
  const h=lifecycleHarness(),old=h.start(h.E.newGame(1,{seed:42}),{animateDeal:true}),oldToken=h.B.capture();
  const next=h.start(h.E.newGame(2,{seed:7}));h.clock.advance(2000);
  assert.equal(h.B.game,next);assert.equal(h.B.isCurrent(oldToken),false);assert.notEqual(old.settlement.handId,next.settlement.handId);
  assert.equal(h.debug.B.els.size,54);for(const id of h.debug.B.els.keys())assert.ok(next.cols.flat().some(c=>c.id===id));
});

test('new game during animation discards callbacks for detached old nodes',()=>{
  const h=lifecycleHarness(),old=h.start(undefined,{animateDeal:true});h.clock.advance(16);const oldNodes=[...h.debug.B.els.values()],callbacks=h.animations.map(a=>a.onfinish).filter(Boolean);
  const next=h.start(h.E.newGame(4,{seed:11}));h.clock.advance(16);const positions=[...h.debug.B.els.values()].map(n=>n.style.transform);
  callbacks.forEach(fn=>fn());h.clock.advance(2000);assert.equal(h.B.game,next);assert.ok(oldNodes.every(n=>!n.isConnected));assert.equal(old.moves,0);assert.deepEqual([...h.debug.B.els.values()].map(n=>n.style.transform),positions);
});

test('abandon and repeated dispose release timers, workers, frames and pending work',()=>{
  const h=lifecycleHarness(),g=h.start(undefined,{animateDeal:true});h.clock.advance(16);let calls=0;h.B.later(()=>calls++,100);
  h.S.abandonGame();h.B.dispose();h.B.dispose();h.clock.advance(5000);
  assert.equal(calls,0);assert.equal(h.B.game,null);assert.equal(h.clock.intervals,0);assert.equal(h.debug.owned.size,0);assert.equal(h.debug.pendingMap.size,0);assert.equal(h.debug.B.els.size,0);assert.equal(g.elapsed,16);
});

test('navigation away and a late sheet close cannot accrue hidden-game time',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(123.5);const close=h.UI.sheet({title:'Paused'});
  const paused=g.elapsed;h.UI.go('home');h.clock.advance(4000);close();h.clock.advance(1000);
  assert.equal(g.elapsed,paused);assert.equal(h.S.state.stats.playMs,paused);assert.equal(h.clock.intervals,0);
});

test('fractional active time survives repeated pause/resume and startTimer calls without double counting',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(125.25);h.B.pause(true);assert.equal(g.elapsed,125.25);
  for(let i=0;i<4;i++){h.B.pause(true);h.clock.advance(200);}
  h.B.pause(false);h.B.pause(false);h.B.startTimer();h.B.startTimer();assert.equal(h.clock.intervals,1);
  h.clock.advance(88.75);h.B.pause(true);assert.equal(g.elapsed,214);assert.equal(h.S.state.stats.playMs,214);assert.equal(h.clock.intervals,0);
});

test('visibility/page transitions exclude background time and never create a catch-up tick',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(200);h.visibility(true);assert.equal(g.elapsed,200);h.clock.advance(10000);
  h.visibility(false);h.clock.advance(50);h.page('pagehide');assert.equal(g.elapsed,250);h.clock.advance(9000);
  h.page('pageshow');h.clock.advance(75);h.B.stopTimer();assert.equal(g.elapsed,325);assert.equal(h.clock.intervals,0);
});

test('reset/replacement clears the old timer reference and cannot pollute fresh statistics',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(300);assert.equal(h.S.reset(),true);
  h.clock.advance(5000);assert.equal(h.B.game,null);assert.equal(h.S.state.stats.playMs,0);assert.equal(h.clock.intervals,0);assert.equal(g.elapsed,300);
});

test('elapsed time and persistent receipt round-trip through the unchanged v2 save boundary',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(213.75);h.B.pause(true);const receipt=plain(g.settlement);
  assert.equal(h.S.save(true),true);h.S.load();assert.equal(h.B.game,null);const loaded=h.S.state.game;
  assert.equal(loaded.elapsed,213.75);assert.deepEqual(plain(loaded.settlement),receipt);h.B.start(loaded);h.clock.advance(50);h.B.pause(true);assert.equal(loaded.elapsed,263.75);
});

for(const manual of ['undo','selection','deal','keyboard'])test(`auto-complete is synchronously cancelled by manual ${manual} during its await`,async()=>{
  const h=lifecycleHarness({autocomplete:true}),g=h.start(finalHand(h.E,2));h.clock.advance(700);assert.ok(h.debug.B.plan);
  const running=h.B.runAutoComplete();assert.equal(g.moves,1);assert.equal(h.debug.B.autoRunning,true);
  if(manual==='undo')h.B.doUndo();if(manual==='selection')h.B.select(0,0);if(manual==='deal')h.B.doDeal();if(manual==='keyboard')h.keydown({key:'Escape'});
  const moves=g.moves;await turns();await running;h.clock.advance(1500);await turns();
  assert.equal(g.moves,moves);assert.equal(h.debug.B.autoRunning,false);assert.equal(h.debug.B.autoRun,null);assert.equal(h.S.state.stats.wins,0);
});

test('explicit auto cancellation resolves its awaited task and cannot affect a replacement session',async()=>{
  const h=lifecycleHarness({autocomplete:true}),g=h.start(finalHand(h.E,2));h.clock.advance(700);const running=h.B.runAutoComplete();
  h.B.cancelAutoComplete();await running;assert.equal(g.moves,1);const next=h.start();h.clock.advance(2000);await turns();assert.equal(next.moves,0);assert.equal(h.debug.B.autoRunning,false);
});

test('auto-complete executes each legal planned move once and pays once',async()=>{
  const h=lifecycleHarness({autocomplete:true}),g=h.start(finalHand(h.E,2));h.clock.advance(700);const expected=h.debug.B.plan.length,running=h.B.runAutoComplete();
  for(let i=0;i<expected+2;i++){h.clock.advance(170);await turns();}await running;
  assert.equal(g.moves,expected);assert.equal(g.won,true);assert.equal(h.S.state.stats.wins,1);assert.equal(h.S.state.embers,85);assert.equal(h.debug.B.autoRunning,false);
});

for(const operation of ['undo','replacement','navigation'])test(`old worker replies/errors after ${operation} cannot show a stuck dialog`,()=>{
  const h=lifecycleHarness({stuck:true}),g=h.start(finalHand(h.E,2));h.clock.advance(700);const worker=h.workers.at(-1);assert.ok(worker);const request=worker.requests[0],reply=worker.onmessage,error=worker.onerror;let prompts=0;h.B.onStuck=()=>prompts++;
  if(operation==='undo'){h.B.doMove(1,0,0);h.B.doUndo();}if(operation==='replacement')h.start();if(operation==='navigation')h.UI.go('home');
  reply({data:{...request,stuck:true}});error();assert.equal(prompts,0);assert.equal(worker.terminated,true);assert.equal(h.debug.pendingMap.size,0);
});

test('one current worker request is bounded and a matching current result is delivered exactly once',()=>{
  const h=lifecycleHarness({stuck:true});h.start(finalHand(h.E,2));h.clock.advance(700);const worker=h.workers.at(-1),request=worker.requests[0];let prompts=0;h.B.onStuck=()=>prompts++;
  for(let i=0;i<10;i++)h.debug.endgameChecks();assert.equal(worker.requests.length,1);assert.equal(h.debug.pendingMap.size,1);
  worker.onmessage({data:{...request,stuck:true}});worker.onmessage({data:{...request,stuck:true}});assert.equal(prompts,1);assert.equal(h.debug.pendingMap.size,0);
});

test('repeated victory scheduling has only one current presentation callback',()=>{
  const h=lifecycleHarness(),g=h.start(finalHand(h.E));h.clock.advance(16);let shown=0;h.B.onWin=()=>shown++;h.B.doMove(1,0,0);
  h.B.pause(false);h.B.pause(false);h.clock.advance(2000);assert.equal(shown,1);assert.equal(g.won,true);assert.equal(h.S.state.stats.wins,1);
});

function wireCeremony(h,ad=()=>Promise.resolve()) {
  const es=h.context.ES,counters={wins:0,ads:0};
  es.Screens={endGame(){},stokeButton:()=>''};es.Ads={offer:()=>false,gameFinished(){counters.ads++;},maybeInterstitial:ad};
  h.load('ceremony');h.B.onWin=(g,out)=>{counters.wins++;return es.Ceremony.victory(g,out);};return counters;
}

test('duplicate victory entry cannot duplicate overlays, analytics or ad pacing',()=>{
  const h=lifecycleHarness(),c=wireCeremony(h),g=h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.clock.advance(1400);
  const layer=h.document.querySelector('.ceremony');assert.ok(layer);assert.equal(c.ads,1);assert.equal(c.wins,1);
  assert.equal(h.context.ES.Ceremony.victory(g,{ember:85}),false);assert.equal(c.ads,1);
  assert.equal(h.events.filter(e=>e[0]==='analytics'&&e[1]==='game_win').length,1);
  h.B.doUndo();assert.equal(layer.isConnected,false);h.B.doMove(1,0,0);h.clock.advance(1400);assert.equal(c.ads,1);assert.equal(h.document.querySelector('.ceremony'),null);
});

test('undo then replay before presentation produces one legitimate current victory experience',()=>{
  const h=lifecycleHarness(),c=wireCeremony(h),g=h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.clock.advance(500);h.B.doUndo();h.B.doMove(1,0,0);h.clock.advance(1400);
  assert.ok(h.document.querySelector('.ceremony'));assert.equal(c.ads,1);assert.equal(h.S.state.stats.wins,1);assert.equal(g.settlement.victoryPaid,true);
});

for(const replacement of ['newgame','navigation','reset'])test(`awaited victory ad cannot abandon/navigate a ${replacement} replacement`,async()=>{
  const h=lifecycleHarness();let release;const c=wireCeremony(h,()=>new Promise(r=>{release=r;}));const old=h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.clock.advance(1400);
  const layer=h.document.querySelector('.ceremony'),leave=layer.querySelector('#vicAgain').onclick();assert.ok(release);
  let current;if(replacement==='newgame')current=h.start();if(replacement==='navigation')h.UI.go('settings');if(replacement==='reset')h.S.reset();
  const page=h.UI.current,balance=h.S.state.embers;release();await leave;h.clock.advance(2000);
  assert.equal(h.UI.current,page);assert.equal(h.S.state.embers,balance);if(current)assert.equal(h.S.state.game,current);
  assert.equal(layer.isConnected,false);assert.equal(c.ads,1);assert.equal(old.settlement.victoryPaid,true);
  await layer.querySelector('#vicAgain').onclick();assert.equal(h.UI.current,page);
});

test('current victory ad completion abandons exactly its own hand and navigates normally',async()=>{
  const h=lifecycleHarness();let release;wireCeremony(h,()=>new Promise(r=>{release=r;}));h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.clock.advance(1400);
  const layer=h.document.querySelector('.ceremony'),leaving=layer.querySelector('#vicForge').onclick();release();await leaving;
  assert.equal(h.S.state.game,null);assert.equal(h.B.game,null);assert.equal(h.UI.current,'forge');assert.equal(h.S.state.stats.wins,1);h.clock.advance(400);assert.equal(layer.isConnected,false);assert.equal(h.clock.intervals,0);
});

test('sheet close is idempotent, releases one hold and cancels delayed focus',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(100);const close=h.UI.sheet({title:'First'}),first=h.document.querySelector('.overlay');
  const secondClose=h.UI.sheet({title:'Second'});assert.equal(h.debug.holds.size,2);secondClose();secondClose();assert.equal(h.debug.holds.size,1);
  h.clock.advance(100);assert.equal(g.elapsed,100);close();close();h.clock.advance(100);h.B.pause(true);assert.equal(g.elapsed,200);assert.equal(h.debug.holds.size,0);
  assert.equal(first.focuses,0);
});

test('worker error falls back only for a current pending request and never repeats a delivered prompt',()=>{
  const h=lifecycleHarness({stuck:true});h.start(finalHand(h.E,2));h.clock.advance(700);let prompts=0;h.B.onStuck=()=>prompts++;h.E.isStuck=()=>true;
  const worker=h.workers.at(-1);worker.onerror();h.clock.advance(0);assert.equal(prompts,1);assert.equal(h.debug.pendingMap.size,0);assert.equal(worker.terminated,true);
  const other=lifecycleHarness({stuck:true});other.start(finalHand(other.E,2));other.clock.advance(700);let count=0;other.B.onStuck=()=>count++;other.E.isStuck=()=>true;
  const w=other.workers.at(-1),request=w.requests[0];w.onmessage({data:{...request,stuck:true}});w.onerror();other.clock.advance(0);assert.equal(count,1);
});

test('a resize/render supersedes animation callbacks even without a position mutation',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(16);const m=h.E.hintBasic(g);h.B.doMove(m.from,m.idx,m.to);const callbacks=h.animations.map(a=>a.onfinish).filter(Boolean),rev=h.B.capture().revision;
  h.get('#board').clientWidth=700;h.B.render({type:'none'});const transforms=[...h.debug.B.els.values()].map(n=>n.style.transform);
  callbacks.forEach(fn=>fn());assert.deepEqual([...h.debug.B.els.values()].map(n=>n.style.transform),transforms);assert.equal(h.B.capture().revision,rev);
});

test('position revisions distinguish alternate positions with identical move/completion counts',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(16);const m=h.E.hintBasic(g);h.B.doMove(m.from,m.idx,m.to);const old=h.B.capture();h.B.doUndo();h.B.doMove(m.from,m.idx,m.to);
  assert.equal(g.moves,1);assert.ok(h.B.capture().revision>old.revision);assert.equal(h.B.isCurrent(old),false);const current=h.B.capture();h.clock.advance(1000);assert.equal(h.B.isCurrent(current),true);
});

test('repeated start/mount/dispose does not accumulate listeners, pending work or intervals',()=>{
  const h=lifecycleHarness();for(let i=0;i<20;i++){const g=h.start();h.B.mount();h.B.start(g);h.B.dispose();}
  h.clock.advance(2000);assert.equal(h.clock.intervals,0);assert.equal(h.debug.owned.size,0);assert.equal(h.debug.pendingMap.size,0);assert.equal(h.debug.invalidators.size,0);assert.equal(h.debug.holds.size,0);assert.equal(h.get('#board').handlers.get('keydown').size,1);
});

test('save/export flush active fractional time without requiring a pause or position revision',()=>{
  const h=lifecycleHarness(),g=h.start(),token=h.B.capture();h.clock.advance(213.75);assert.equal(h.S.save(true),true);
  assert.equal(JSON.parse(h.storage.get(h.S.KEY)).game.elapsed,213.75);h.clock.advance(40.25);assert.equal(JSON.parse(h.S.exportSave()).game.elapsed,254);assert.equal(h.B.isCurrent(token),true);assert.equal(h.clock.intervals,1);
});

function realScreens(h) {
  const es=h.context.ES;es.Manifest.preload=()=>{};es.Ads={gameFinished(){},offer:()=>false};
  h.load('screens');for(const key of ['home','settings','modes'])h.UI.renderers[key]=()=>{};
  return es;
}

test('a screen-owned abandoned-game ad continuation cannot navigate over a newer hand',async()=>{
  const h=lifecycleHarness(),es=realScreens(h);let release;es.Ads.maybeInterstitial=()=>new Promise(r=>{release=r;});
  const g=h.start();g.moves=30;g.elapsed=180000;es.Screens.pauseMenu();const sheet=h.document.querySelector('.overlay');
  sheet.dispatch('click',{target:{closest:s=>s==='[data-i]'?{dataset:{i:'3'}}:null}});
  assert.equal(h.S.state.game,null);assert.ok(release);const next=h.start(h.E.newGame(2,{seed:7}));release();await turns();
  assert.equal(h.UI.current,'game');assert.equal(h.S.state.game,next);assert.equal(h.B.game,next);
});

test('closing a real stuck sheet after navigation cannot unpause a hidden or replaced hand',()=>{
  const h=lifecycleHarness(),es=realScreens(h),g=h.start();h.clock.advance(100);es.Screens.stuckSheet(g);assert.equal(h.debug.holds.size,1);
  const elapsed=g.elapsed;h.UI.go('home');h.clock.advance(1000);assert.equal(g.elapsed,elapsed);assert.equal(h.clock.intervals,0);assert.equal(h.debug.holds.size,0);
});

test('rewarded-ad presentation continuation cannot rerender an obsolete forge screen',async()=>{
  const h=lifecycleHarness(),es=realScreens(h);let release;es.Ads.showRewarded=()=>new Promise(r=>{release=r;});h.UI.go('forge');let rerenders=0;h.UI.renderers.forge=()=>rerenders++;
  const result=es.Screens.stoke('forge',10);h.UI.go('settings');release({granted:true,amount:50});const reward=await result;
  assert.equal(reward.granted,true);assert.equal(rerenders,0);assert.equal(h.UI.current,'settings');
});

test('native-style pause/resume during a legitimate victory ad preserves its guarded continuation',async()=>{
  const h=lifecycleHarness();let release;wireCeremony(h,()=>new Promise(r=>{release=r;}));h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.clock.advance(1400);
  const layer=h.document.querySelector('.ceremony'),leaving=layer.querySelector('#vicForge').onclick();h.B.pause(true);h.clock.advance(5000);h.B.pause(false);release();await leaving;
  assert.equal(h.UI.current,'forge');assert.equal(h.S.state.game,null);assert.equal(h.S.state.stats.wins,1);assert.equal(h.clock.intervals,0);
});

test('completed-hand time stops and undo resumes only new active time',()=>{
  const h=lifecycleHarness(),g=h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);assert.equal(g.elapsed,16);assert.equal(h.clock.intervals,0);
  h.clock.advance(5000);assert.equal(g.elapsed,16);h.B.doUndo();h.clock.advance(125.5);h.B.pause(true);assert.equal(g.elapsed,141.5);assert.equal(h.S.state.stats.wins,1);
});

test('pointer cancellation never turns a cancelled tap into a move or selection',()=>{
  const h=lifecycleHarness(),g=h.start();h.clock.advance(16);const target=[...h.debug.B.els.values()].find(n=>!n.classList.contains('down')),before=plain(g);
  const event={pointerId:1,button:0,clientX:10,clientY:10,target};h.get('#board').dispatch('pointerdown',event);h.get('#board').dispatch('pointercancel',event);
  assert.deepEqual(plain(g),before);assert.equal(h.debug.B.drag,null);assert.equal(h.debug.B.sel,null);
});

for(const sceneName of ['strike','legendary'])test(`${sceneName} scene awaits cannot update detached layers after navigation`,async()=>{
  const h=lifecycleHarness(),es=h.context.ES;es.Screens={hallFocus(){}};h.UI.go('forge');h.load('ceremony');
  let running;if(sceneName==='strike'){h.S.current().heat=1000;running=es.Ceremony.strike();}else running=es.Ceremony.legendary({id:'sword',record:{victories:1,ember:1000,forgingMs:1000}});
  const layer=h.document.querySelector('.ceremony');assert.ok(layer);h.UI.go('home');const eventCount=h.events.length;
  await turns();await running;h.clock.advance(10000);await turns();assert.equal(layer.isConnected,false);assert.equal(h.UI.current,'home');assert.equal(h.events.length,eventCount);assert.equal(h.debug.invalidators.size,0);
});

test('manual cancellation recomputes the finish affordance without running additional moves',async()=>{
  const h=lifecycleHarness({autocomplete:true}),g=h.start(finalHand(h.E,2));h.clock.advance(700);const running=h.B.runAutoComplete();h.B.select(0,0);await running;
  const moves=g.moves;h.clock.advance(700);assert.equal(h.get('#btnFinish').hidden,false);assert.equal(g.moves,moves);assert.equal(h.debug.B.autoRunning,false);
});

test('an abandoned-game ad still continues after native-style pause/resume of the same session',async()=>{
  const h=lifecycleHarness(),es=realScreens(h);let release;es.Ads.maybeInterstitial=()=>new Promise(r=>{release=r;});const g=h.start();g.moves=30;g.elapsed=180000;
  es.Screens.pauseMenu();h.document.querySelector('.overlay').dispatch('click',{target:{closest:s=>s==='[data-i]'?{dataset:{i:'3'}}:null}});
  h.B.pause(true);h.clock.advance(1000);h.B.pause(false);release();await turns();assert.equal(h.UI.current,'modes');assert.equal(h.S.state.game,null);
});

test('the real worker echoes session/revision on success and a safe error result',()=>{
  const h=lifecycleHarness(),g=finalHand(h.E,2),results=[],self={ES:{Engine:h.E},postMessage:r=>results.push(plain(r))};
  vm.runInNewContext(readFileSync(new URL('../site/ember-solitaire/js/stuck-worker.js',import.meta.url),'utf8'),{self,importScripts(){}});
  const payload={id:7,session:3,revision:9,cols:g.cols,stock:g.stock,completed:g.completed};self.onmessage({data:payload});
  assert.deepEqual(results[0],{id:7,session:3,revision:9,stuck:h.E.isStuck(g)});
  self.ES.Engine={isStuck(){throw Error('search failed');}};self.onmessage({data:{...payload,id:8}});assert.deepEqual(results[1],{id:8,session:3,revision:9,stuck:false});
});

test('a delayed recovery file read cannot open import confirmation on a replacement screen',async()=>{
  const h=lifecycleHarness();h.start();h.UI.saveRecovery();const sheet=h.document.querySelector('.overlay'),input=sheet.querySelector('#saveImport');let release;
  const reading=input.onchange({target:{files:[{size:20,text:()=>new Promise(r=>{release=r;})}],value:'file'}});
  h.UI.go('home');release('{"v":2,"embers":50}');await reading;h.clock.advance(300);
  assert.equal(h.document.querySelector('.overlay'),null);assert.equal(h.UI.current,'home');assert.equal(h.S.state.embers,0);
});

test('native app suspension remains effective through replacement until explicit foreground activation',()=>{
  const h=lifecycleHarness(),old=h.start();h.clock.advance(100);h.B.setAppActive(false);const next=h.start();h.clock.advance(5000);
  assert.equal(old.elapsed,100);assert.equal(next.elapsed,0);assert.equal(h.clock.intervals,0);h.B.setAppActive(true);h.clock.advance(50);h.B.pause(true);assert.equal(next.elapsed,50);
});

test('a synchronous progression listener replacing the hand cannot render old completion data into the new board',()=>{
  const h=lifecycleHarness();h.start(finalHand(h.E));h.clock.advance(16);let next;
  h.S.on(event=>{if(event.type==='ember'&&!next)next=h.start(h.E.newGame(2,{seed:99}));});h.B.doMove(1,0,0);h.clock.advance(2000);
  assert.equal(h.B.game,next);assert.equal(h.S.state.game,next);assert.equal(next.moves,0);assert.equal(h.debug.B.els.size,54);assert.equal(h.S.state.stats.wins,1);
});

test('a direct obsolete victory entry while paused cannot trigger analytics or ad pacing',()=>{
  const h=lifecycleHarness(),c=wireCeremony(h),g=h.start(finalHand(h.E));h.clock.advance(16);h.B.doMove(1,0,0);h.B.pause(true);
  assert.equal(h.context.ES.Ceremony.victory(g,{ember:85}),false);assert.equal(c.ads,0);assert.equal(h.document.querySelector('.ceremony'),null);
  h.B.pause(false);h.clock.advance(1400);assert.equal(c.ads,1);
});

test('current tutorial coaching resumes after visibility cancellation of its initial delay',()=>{
  const h=lifecycleHarness();h.load('tutorial');h.context.ES.Tutorial.start();h.clock.advance(100);h.visibility(true);h.clock.advance(3000);h.visibility(false);h.clock.advance(0);
  const coach=h.document.querySelector('.coach');assert.ok(coach);assert.match(coach.innerHTML,/Drag a card/);assert.equal(h.context.ES.Tutorial.active,true);
});

test('replacing a tutorial hand removes its coach and cannot complete FTUE on the newer hand',()=>{
  const h=lifecycleHarness();h.load('tutorial');h.context.ES.Tutorial.start();h.clock.advance(100);const next=h.start(h.E.newGame(2,{seed:5}));h.clock.advance(3000);
  assert.equal(h.B.game,next);assert.equal(h.document.querySelector('.coach'),null);assert.equal(h.context.ES.Tutorial.active,false);assert.equal(h.S.state.ftue.tutorial,false);
});
