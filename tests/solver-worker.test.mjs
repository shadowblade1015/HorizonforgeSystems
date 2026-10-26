import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {lifecycleHarness,finalHand} from './lifecycle-helpers.mjs';
import {plain} from './helpers.mjs';
const source=readFileSync(new URL('../site/ember-solitaire/js/stuck-worker.js',import.meta.url),'utf8');
function setup(){const h=lifecycleHarness({autocomplete:true,manualWorker:true});h.start(finalHand(h.E,2));h.clock.advance(700);return h;}
function deliver(h,worker=h.workers.at(-1),extra={}){const r=worker.requests.at(-1);worker.onmessage?.({data:{...r,status:'solved',plan:plain(h.E.solveEndgame(r,20000)),...extra}});}
function actualWorker(E,payload){const result=[],imports=[],self={ES:{Engine:E},postMessage:r=>result.push(plain(r))};vm.runInNewContext(source,{self,performance:{now:()=>12},importScripts:p=>imports.push(p)});self.onmessage({data:plain(payload)});assert.deepEqual(imports,['engine.js']);return result[0];}

test('real worker preserves the existing DFS plan, identity and immutable input',()=>{
 const h=setup(),request=h.workers[0].requests[0],before=plain(request),expected=plain(h.E.solveEndgame(request,20000));
 const r=actualWorker(h.E,request);assert.equal(r.status,'solved');assert.deepEqual(r.plan,expected);assert.deepEqual(plain(request),before);
 for(const key of ['id','type','session','revision','workEpoch'])assert.equal(r[key],request[key]);
 const g=finalHand(h.E,2);for(const m of r.plan){assert.equal(h.E.canMove(g,m.from,m.idx,m.to),true);assert.equal(h.E.move(g,m.from,m.idx,m.to).ok,true);}assert.equal(g.won,true);
});
test('hard null result reports no plan within budget rather than impossibility',()=>{
 const h=setup(),request=h.workers[0].requests[0];let budget;
 const r=actualWorker({solveEndgame(g,n){budget=n;return null;}},request);assert.equal(budget,20000);assert.equal(r.status,'no-plan-within-budget');assert.equal(r.plan,null);
});
test('worker exception never invents a plan or a stuck verdict',()=>{
 const h=setup(),request=h.workers[0].requests[0];for(const type of ['endgame','stuck']){const r=actualWorker({solveEndgame(){throw Error('crash')},isStuck(){throw Error('crash')}},{...request,type});assert.equal(r.status,'unavailable');assert.equal(r.stuck,false);assert.equal(r.plan,null);}
});
test('Board only requests planning, exposes a valid result and never runs DFS on main',()=>{
 const h=setup();h.E.solveEndgame=()=>{throw Error('Main-thread DFS forbidden');};const w=h.workers[0],r=w.requests[0];
 assert.equal(r.type,'endgame');assert.equal(h.debug.B.plan,null);assert.equal(h.get('#btnFinish').hidden,true);assert.equal(h.B.searchStatus.state,'searching');
 w.onmessage({data:{...r,status:'solved',plan:[{from:1,idx:0,to:0},{from:2,idx:0,to:0}]}});
 assert.equal(h.get('#btnFinish').hidden,false);assert.equal(h.B.searchStatus.state,'solved');assert.equal(h.debug.pendingMap.size,0);assert.equal(h.S.state.stats.wins,0);
});
test('repeated checks maintain one pending request and one worker',()=>{
 const h=setup();for(let i=0;i<100;i++)h.debug.endgameChecks();assert.equal(h.workers.length,1);assert.equal(h.workers[0].requests.length,1);assert.equal(h.debug.pendingMap.size,1);
 deliver(h);for(let i=0;i<20;i++)h.debug.endgameChecks();assert.equal(h.workers[0].requests.length,1);assert.equal(h.debug.pendingMap.size,0);
});
for(const operation of ['move','undo-alternate','restart','navigation','pause','abandon','read-only'])test(`late endgame reply after ${operation} is discarded without reward/save`,()=>{
 const h=setup(),w=h.workers[0],r=plain(w.requests[0]),reply=w.onmessage,error=w.onerror,plan=plain(h.E.solveEndgame(r,20000));
 if(operation==='move')h.B.doMove(1,0,0);
 if(operation==='undo-alternate'){assert.equal(h.B.doMove(1,0,0),true);h.B.doUndo();assert.equal(h.B.doMove(1,0,3),true);}
 if(operation==='restart')h.start();if(operation==='navigation')h.UI.go('home');if(operation==='pause')h.B.pause(true);
 if(operation==='abandon')h.S.abandonGame();if(operation==='read-only')h.S.releaseWriter();
 const before=plain(h.S.state),raw=h.storage.get(h.S.KEY);reply({data:{...r,status:'solved',plan}});error();h.clock.advance(20);
 assert.equal(h.debug.B.plan,null);assert.equal(h.get('#btnFinish').hidden,true);assert.equal(h.debug.pendingMap.size,0);assert.equal(w.terminated,true);assert.equal(h.S.state.stats.wins,before.stats.wins);assert.equal(h.storage.get(h.S.KEY),raw);
});
test('a no-stock deal attempt does not invalidate an unchanged planning position',()=>{
 const h=setup(),token=h.B.capture();h.B.doDeal();assert.equal(h.B.isCurrent(token),true);assert.equal(h.debug.pendingMap.size,1);deliver(h);assert.ok(h.debug.B.plan);
});
for(const failure of ['constructor','missing','crash','messageerror','postMessage','timeout'])test(`worker ${failure} fails conservatively without main search or request leaks`,()=>{
 const h=lifecycleHarness({autocomplete:true,manualWorker:true});
 h.E.solveEndgame=h.E.isStuck=()=>{throw Error('No expensive synchronous fallback');};
 if(failure==='constructor')h.context.Worker=class{constructor(){throw Error('CSP/unsupported');}};
 if(failure==='missing')h.context.Worker=undefined;
 h.start(finalHand(h.E,2));h.clock.advance(700);const w=h.workers.at(-1);
 if(failure==='crash')w.onerror();if(failure==='messageerror')w.onmessageerror();
 if(failure==='postMessage'){h.B.pause(true);h.context.Worker=class{postMessage(){throw Error('clone failed');}terminate(){}};h.B.pause(false);h.clock.advance(700);}
 if(failure==='timeout')h.clock.advance(4001);
 h.clock.advance(31); // The existing live-region announcement uses an owned 30ms delay.
 assert.equal(h.debug.pendingMap.size,0);assert.equal(h.debug.B.plan,null);assert.equal(h.get('#btnFinish').hidden,true);assert.equal(h.B.searchStatus.state,failure==='timeout'?'timeout':'unavailable');assert.match(h.get('#gLive').textContent,/keep playing manually/);
 assert.equal(h.B.doMove(1,0,0),true);assert.equal(h.S.state.stats.wins,0);
});
test('bad identity cannot consume a pending result; deadline cleans it up',()=>{
 const h=setup(),w=h.workers[0],r=w.requests[0];for(const key of ['id','session','revision','workEpoch','type'])w.onmessage({data:{...r,[key]:'incorrect',status:'solved',plan:[{from:1,idx:0,to:0}]}});
 assert.equal(h.debug.pendingMap.size,1);assert.equal(h.debug.B.plan,null);h.clock.advance(4001);assert.equal(h.debug.pendingMap.size,0);assert.equal(w.terminated,true);
});
test('illegal suggested move is not offered and each automated step is revalidated',async()=>{
 const h=setup();deliver(h,undefined,{plan:[{from:9,idx:99,to:0}]});assert.equal(h.debug.B.plan,null);assert.equal(h.get('#btnFinish').hidden,true);
 h.B.pause(true);h.B.pause(false);h.clock.advance(700);deliver(h,undefined,{plan:[{from:1,idx:0,to:0},{from:9,idx:99,to:0}]});const run=h.B.runAutoComplete();h.clock.advance(170);await Promise.resolve();await run;assert.equal(h.S.state.game.moves,1);assert.equal(h.S.state.stats.wins,0);
});
test('a timed-out request cannot affect a subsequent request on the same position',()=>{
 const h=setup(),old=h.workers[0],reply=old.onmessage,r=plain(old.requests[0]);h.clock.advance(4001);h.B.pause(true);h.B.pause(false);h.clock.advance(700);
 const next=h.workers.at(-1);assert.notEqual(next,old);reply({data:{...r,status:'solved',plan:plain(h.E.solveEndgame(r,20000))}});assert.equal(h.debug.B.plan,null);assert.equal(h.debug.pendingMap.size,1);deliver(h,next);assert.ok(h.debug.B.plan);
});
test('iterative planner preserves 19 captured recursive plans and node-budget boundaries',()=>{
 const {E}=lifecycleHarness(),fixture=JSON.parse(readFileSync(new URL('./fixtures/endgame-plans.json',import.meta.url),'utf8'));
 for(const c of fixture.cases){let g;if(c.kind==='final')g=finalHand(E,c.split);else{g=E.newGame(4,{seed:c.seed});while(g.stock.length)E.deal(g);g.cols.flat().forEach(c=>c.up=true);g.history=[];}
  const before=plain(g);assert.deepEqual(plain(E.solveEndgame(g,c.limit)),c.expected,JSON.stringify(c));assert.deepEqual(plain(g),before);
 }
});
