import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {harness, plain} from './helpers.mjs';
const ID = /^h-[0-9a-z]+-[0-9a-z]+-[0-9a-f]{32}$/;
const handFixture = readFileSync(new URL('./fixtures/hand-v2.json', import.meta.url), 'utf8');
const profileFixture = readFileSync(new URL('./fixtures/profile-v2.json', import.meta.url), 'utf8');

// All 104 identities are accounted for: seven removed complete sequences and
// the canonical remaining spade sequence, split into K-2 plus the final Ace.
function finalHand(E, suits = 1, daily = false) {
  const g = E.newGame(suits, {seed: 42, daily, dailyKey: daily ? '2026-10-22' : null});
  const run = E.newDeck(suits, () => 0).filter(c => parseInt(c.id.slice(1), 36) < 13).sort((a,b) => b.rank-a.rank);
  run.forEach(c => {c.up = true;});
  g.cols = [run.slice(0,12), run.slice(12), [], [], [], [], [], [], [], []];
  g.stock = []; g.completed = g.bestCompleted = 7; g.run = 0;
  return g;
}
function win(E,S,g) { const res = E.move(g,1,0,0); assert.equal(res.won,true); return {res,out:S.applyResult(g,res)}; }
function start(suits=1,daily=false,raw=null,options={}) {
  const h=harness(raw,options); h.S.load(); const g=finalHand(h.E,suits,daily);h.S.startGame(g);
  assert.equal(h.S.validateHand(g),true); assert.equal(h.S.persistence.unsaved,false);
  return {...h,g};
}

for(const suits of [1,2,4]) test(`${suits}-suit victory pays once, survives undo/replay and duplicate callback copies`,()=>{
  const {E,S,storage,g,context}=start(suits);
  const id=g.settlement.handId;assert.match(id,ID);
  const events=[];context.ES.Analytics={log:(name,params)=>events.push({name,params})};
  const {res,out}=win(E,S,g),reward=S.WIN_REWARD[suits],expected=S.SET_REWARD+reward;
  assert.deepEqual(plain(out),{ember:expected,win:reward});
  assert.equal(S.state.embers,expected);assert.equal(S.state.totalEmber,expected);
  assert.equal(S.state.stats.wins,1);assert.equal(S.state.stats.bySuits[suits].wins,1);
  assert.equal(S.state.stats.streak,1);assert.equal(S.state.stats.bestStreak,1);
  assert.equal(S.state.stats.sequences,1);assert.equal(S.current().victories,1);
  assert.equal(S.current().ember,expected);assert.equal(S.current().heat,expected);assert.equal(g.run,expected);
  assert.equal(g.settlement.victoryPaid,true);
  const settled=plain(S.state),eventCount=events.length;
  for(let i=0;i<5;i++) for(const r of [res,plain(res)]) assert.deepEqual(plain(S.applyResult(g,r)),{ember:0});
  assert.deepEqual(plain(S.state),settled);assert.equal(events.length,eventCount);
  E.undo(g);assert.equal(g.settlement.handId,id);assert.equal(g.settlement.victoryPaid,true);
  const replay=E.move(g,1,0,0);assert.equal(replay.won,true);assert.equal(replay.newSets,0);
  assert.deepEqual(plain(S.applyResult(g,replay)),{ember:0});
  assert.equal(S.state.embers,expected);assert.equal(S.state.stats.wins,1);assert.equal(S.current().victories,1);
  assert.equal(S.save(true),true);
  const saved=JSON.parse(storage.get(S.KEY));assert.deepEqual(saved.game.settlement,{v:1,handId:id,victoryPaid:true});
  const reload=harness(storage.get(S.KEY));reload.S.load();
  assert.equal(reload.S.persistence.blocked,false);assert.deepEqual(plain(reload.S.state),saved);
  assert.deepEqual(plain(reload.S.applyResult(reload.S.state.game,res)),{ember:0});
  assert.deepEqual(plain(reload.S.state),saved);
});

test('separate new/restarted hands with identical seeds, mode, time and cards get distinct identities and rewards',()=>{
  const {E,S,g}=start();win(E,S,g);const firstId=g.settlement.handId;
  S.abandonGame();const next=finalHand(E);S.startGame(next);
  assert.equal(next.seed,g.seed);assert.equal(next.startedAt,g.startedAt);assert.notEqual(next.settlement.handId,firstId);
  assert.deepEqual(plain(S.applyResult(g,{ok:true,won:true,newSets:1,type:'move'})),{ember:0});
  win(E,S,next);assert.equal(S.state.stats.wins,2);assert.equal(S.state.embers,2*(S.SET_REWARD+S.WIN_REWARD[1]));
  const before=plain(S.state);S.startGame(next);assert.deepEqual(plain(S.state),before);
});

test('legacy active hand gains metadata without losing any v2 profile/hand fields and keeps identity across export/load',()=>{
  const {S,storage,E}=harness(handFixture);S.load();const expected=JSON.parse(handFixture);
  assert.match(S.state.game.settlement.handId,ID);
  expected.game.settlement={v:1,handId:S.state.game.settlement.handId,victoryPaid:false};
  assert.deepEqual(plain(S.state),expected);assert.equal(storage.get(S.KEY),handFixture);
  const id=expected.game.settlement.handId;E.undo(S.state.game);assert.equal(S.state.game.settlement.handId,id);
  assert.equal(S.save(true),true);const reload=harness(storage.get(S.KEY));reload.S.load();assert.equal(reload.S.state.game.settlement.handId,id);
  const imported=harness();imported.S.load();assert.equal(imported.S.importSave(S.exportSave()),true);assert.equal(imported.S.state.game.settlement.handId,id);
});

test('legacy v2 profile without a hand or settlement data keeps all earned progress unchanged',()=>{
  const {S}=harness(profileFixture);S.load();const before=plain(S.state);
  assert.equal(S.save(true),true);before.savedAt=S.state.savedAt;const reload=harness(S.exportSave());reload.S.load();assert.deepEqual(plain(reload.S.state),before);
});

for(const undone of [false,true]) test(`legacy previously completed hand is conservatively paid on load (undone=${undone})`,()=>{
  const {E,S,g}=start(2,true,profileFixture);win(E,S,g);
  if(undone) E.undo(g);
  const legacy=JSON.parse(S.exportSave());delete legacy.game.settlement;const raw=JSON.stringify(legacy);
  const reload=harness(raw);reload.S.load();const loaded=reload.S.state.game;
  assert.equal(reload.S.persistence.blocked,false);assert.equal(loaded.settlement.victoryPaid,true);
  const expected=plain(legacy);expected.game.settlement=plain(loaded.settlement);assert.deepEqual(plain(reload.S.state),expected);
  if(undone) { const replay=reload.E.move(loaded,1,0,0);assert.equal(replay.won,true);reload.S.applyResult(loaded,replay); }
  else reload.S.applyResult(loaded,{ok:true,won:true,newSets:1,type:'move'});
  assert.equal(reload.S.state.embers,legacy.embers);assert.deepEqual(plain(reload.S.state.stats),legacy.stats);
  assert.deepEqual(plain(reload.S.state.progress),legacy.progress);assert.deepEqual(plain(reload.S.state.daily),legacy.daily);
});

test('daily bonus, perfect ledger, artifact heat/reserve and derived achievement thresholds are not repeated',()=>{
  const {E,S,g}=start(4,true);const first=win(E,S,g),expected=S.SET_REWARD+S.WIN_REWARD[4]+S.DAILY_REWARD;
  assert.equal(S.state.embers,expected);assert.equal(S.state.stats.dailies,1);assert.equal(S.state.stats.bySuits[4].wins,1);
  assert.deepEqual(plain(S.state.daily[g.dailyKey]),{sets:8,rewarded:true,perfect:true});
  const before=plain(S.state);S.applyResult(g,first.res);assert.deepEqual(plain(S.state),before);
  E.undo(g);win(E,S,g);assert.equal(S.state.embers,expected);assert.equal(S.state.stats.dailies,1);
  const second=finalHand(E,4,true);S.startGame(second);win(E,S,second);
  assert.equal(S.state.stats.wins,2);assert.equal(S.state.stats.dailies,1);
  assert.equal(S.state.embers,expected+S.SET_REWARD+S.WIN_REWARD[4]);
  assert.equal(S.current().victories,2);assert.equal(S.current().ember,S.state.totalEmber);
});

for(const failingKey of ['primary','backup']) test(`failed ${failingKey} write keeps a complete in-memory settlement; retry and reload cannot pay again`,()=>{
  const options={}, {E,S,g,storage}=start(1,false,null,options),beforeRaw=storage.get(S.KEY);
  options.failKey=key=>key===(failingKey==='primary'?S.KEY:S.BACKUP_KEY);
  const {res}=win(E,S,g);assert.equal(S.persistence.unsaved,true);assert.equal(storage.get(S.KEY),beforeRaw);
  assert.equal(g.settlement.victoryPaid,true);assert.equal(S.state.stats.wins,1);
  S.applyResult(g,res);assert.equal(S.state.embers,85);assert.equal(S.persistence.unsaved,true);
  options.failKey=null;assert.equal(S.save(true),true);assert.equal(S.persistence.unsaved,false);
  const reload=harness(storage.get(S.KEY));reload.S.load();assert.equal(reload.S.state.stats.wins,1);assert.equal(reload.S.state.embers,85);
  reload.S.applyResult(reload.S.state.game,res);assert.equal(reload.S.state.embers,85);
  const crash=harness(beforeRaw);crash.S.load();assert.equal(crash.S.state.game.settlement.victoryPaid,false);
  win(crash.E,crash.S,crash.S.state.game);assert.equal(crash.S.state.embers,85);assert.equal(crash.S.state.stats.wins,1);
});

test('reentrant notification listeners observe and save only complete settlement snapshots',()=>{
  const {E,S,g,context}=start(2,true),writes=[];
  const original=context.localStorage.setItem;
  context.localStorage.setItem=(key,raw)=>{if(key===S.KEY)writes.push(JSON.parse(raw));return original(key,raw);};
  let callback=null,reentered=false;
  S.on(evt=>{if(evt.type==='ember') {assert.equal(S.state.stats.wins,1);assert.equal(g.settlement.victoryPaid,true);if(!reentered){reentered=true;S.save(true);S.applyResult(g,callback);}}});
  callback=E.move(g,1,0,0);S.applyResult(g,callback);
  assert.ok(reentered);assert.ok(writes.length>=1);
  for(const saved of writes){assert.equal(saved.game.settlement.victoryPaid,true);assert.equal(saved.stats.wins,1);assert.equal(saved.stats.dailies,1);assert.equal(saved.embers,S.SET_REWARD+S.WIN_REWARD[2]+S.DAILY_REWARD);}
});

test('calculation exceptions roll back progression before persistence and allow a safe settlement retry',()=>{
  const {E,S,g,storage,context}=start();const before=plain(S.state),raw=storage.get(S.KEY),res=E.move(g,1,0,0);
  context.ES.Config={num(){throw Error('config failed');}};
  assert.throws(()=>S.applyResult(g,res),/config failed/);
  assert.equal(storage.get(S.KEY),raw);assert.equal(S.state.embers,before.embers);assert.deepEqual(plain(S.state.stats),before.stats);
  assert.equal(g.settlement.victoryPaid,false);delete context.ES.Config;
  S.applyResult(g,res);assert.equal(S.state.embers,85);assert.equal(S.state.stats.wins,1);assert.equal(S.persistence.unsaved,false);
});

const invalidReceipts=[null,[],{}, {v:2,handId:'x',victoryPaid:false}, {v:1,handId:'',victoryPaid:false}, {v:1,handId:7,victoryPaid:false}, {v:1,handId:'h-a-1-'+'a'.repeat(32),victoryPaid:'false'}, {v:1,handId:'h-a-1-'+'a'.repeat(32),victoryPaid:true}, {v:1,handId:'h-a-1-'+'a'.repeat(32),victoryPaid:false,extra:true}];
for(const [i,receipt] of invalidReceipts.entries()) test(`malformed/unsupported settlement receipt ${i} is quarantined without changing currency`,()=>{
  const data=JSON.parse(handFixture);data.game.settlement=receipt;const raw=JSON.stringify(data),{S,storage}=harness(raw);S.load();
  assert.equal(S.persistence.blocked,true);assert.equal(S.state.game,null);assert.equal(S.state.embers,data.embers);assert.equal(S.state.stats.wins,data.stats.wins);
  assert.equal(storage.get(S.KEY),raw);assert.equal(storage.get(S.persistence.recoveryKey),raw);assert.equal(S.save(true),false);assert.throws(()=>S.inspectImport(raw));
});

test('a completed hand with an explicit unpaid v1 receipt is protected as inconsistent, not silently paid',()=>{
  const {E,S,g}=start();win(E,S,g);const data=JSON.parse(S.exportSave());data.game.settlement.victoryPaid=false;
  const raw=JSON.stringify(data),reload=harness(raw);reload.S.load();assert.equal(reload.S.persistence.blocked,true);assert.equal(reload.S.state.embers,data.embers);assert.equal(reload.storage.get(S.KEY),raw);
});

test('protected unsupported profile cannot be overwritten by a new in-memory victory',()=>{
  const raw='{"v":3,"embers":999}',{E,S,storage}=harness(raw);S.load();const g=finalHand(E);S.startGame(g);win(E,S,g);
  assert.equal(S.persistence.blocked,true);assert.equal(S.persistence.unsaved,true);assert.equal(storage.get(S.KEY),raw);
});

test('opening/reopening the actual victory ceremony never settles progression',()=>{
  const {E,S,g,context}=start();const {out}=win(E,S,g),before=plain(S.state);
  const node=()=>({classList:{add(){},remove(){}},setAttribute(){},querySelector:s=>s==='#vicStoke'?null:({style:{setProperty(){}},focus(){}})});
  context.document={createElement:node,getElementById:()=>({appendChild(){}})};context.requestAnimationFrame=fn=>fn();
  const es=context.ES;
  es.UI={esc:String,n:String,I:()=>'',clock:String,artifactStage:()=>'',molten:()=>'',wireHeat(){}};
  es.Audio={play(){},haptic(){}};es.Analytics={log(){}};es.Screens={endGame(){},stokeButton:()=>''};
  es.Ads={gameFinished(){},offer:()=>false};es.FX={motion:()=>false,setField(){}};
  vm.runInContext(readFileSync(new URL('../site/ember-solitaire/js/ceremony.js',import.meta.url),'utf8'),context);
  es.Ceremony.victory(g,out);es.Ceremony.victory(g,out);
  assert.deepEqual(plain(S.state),before);
});

test('identity is independent of seed and has a session counter even with repeated entropy/time',()=>{
  const {E,S}=harness(null,{globals:{crypto:{getRandomValues(words){words.fill(0);return words;}}}});S.load();
  const ids=[];for(let i=0;i<3;i++){const g=finalHand(E);S.startGame(g);ids.push(g.settlement.handId);}
  assert.equal(new Set(ids).size,3);ids.forEach(id=>assert.match(id,ID));
});

test('an incomplete hand or detached copy cannot claim a victory callback',()=>{
  const {S,g}=start(),before=plain(S.state);
  assert.deepEqual(plain(S.applyResult(g,{ok:true,won:true,newSets:1})),{ember:0});
  assert.deepEqual(plain(S.applyResult(plain(g),{ok:true,won:true,newSets:1})),{ember:0});
  assert.deepEqual(plain(S.state),before);
});

test('legacy undo-after-win metadata is also normalized safely through validated imports',()=>{
  const {E,S,g}=start();win(E,S,g);E.undo(g);
  const old=JSON.parse(S.exportSave());delete old.game.settlement;
  const next=harness();next.S.load();assert.equal(next.S.importSave(JSON.stringify(old)),true);
  const loaded=next.S.state.game;assert.equal(loaded.settlement.victoryPaid,true);
  win(next.E,next.S,loaded);assert.equal(next.S.state.embers,old.embers);assert.equal(next.S.state.stats.wins,old.stats.wins);
});

test('win-based achievement thresholds and later forging/artifact selection cannot be advanced by replayed settlement',()=>{
  const {E,S,g}=start(2,false,profileFixture);
  S.state.stats.wins=9;S.state.stats.streak=4;S.state.stats.bestStreak=4;
  S.current().heat=1000;
  const {res}=win(E,S,g);
  assert.equal(S.state.stats.wins,10);assert.equal(S.state.stats.bestStreak,5);assert.equal(S.state.stats.bySuits[2].wins,1);
  assert.equal(S.strike().kind,'tier');assert.equal(S.selectArtifact('shield'),true);
  const after=plain(S.state);S.applyResult(g,res);S.applyResult(g,plain(res));
  assert.deepEqual(plain(S.state),after);assert.equal(S.state.progress.shield.victories,0);assert.equal(S.state.progress.shield.ember,0);
});
