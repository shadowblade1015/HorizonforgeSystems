import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {harness, plain, card, position} from './helpers.mjs';
import {archiveFiles, root} from '../tools/verify-source.mjs';
import {resolve} from 'node:path';

const run = (prefix='r',suit='S') => Array.from({length:13},(_,i)=>card(prefix+i,13-i,suit));

for (const [name,col,idx,expected] of [
  ['single face-up card',[card('a',7)],0,true],
  ['single face-down card',[card('a',7,'S',false)],0,false],
  ['descending same-suit run',[card('a',9),card('b',8),card('c',7)],0,true],
  ['face-down leading card',[card('a',9,'S',false),card('b',8),card('c',7)],0,false],
  ['face-down middle card',[card('a',9),card('b',8,'S',false),card('c',7)],0,false],
  ['face-down final card',[card('a',9),card('b',8),card('c',7,'S',false)],0,false],
  ['unselected face-down predecessor',[card('down',10,'H',false),card('a',9),card('b',8)],1,true],
  ['mixed-suit run',[card('a',9),card('b',8,'H')],0,false],
  ['rank gap',[card('a',9),card('b',7)],0,false],
  ['ascending run',[card('a',8),card('b',9)],0,false],
  ['empty column',[],0,false],
  ['empty selected suffix',[card('a',9)],1,false]
]) test('movable: '+name,()=>{
  const {E}=harness(),before=plain(col);
  assert.equal(E.movable(col,idx),expected);assert.deepEqual(col,before);
});

test('legal suffix moves to a rank build or empty column, reveals its predecessor and undoes exactly',()=>{
  for(const empty of [false,true]) {
    const {E}=harness(),g=position(E);
    g.cols[0]=[card('covered',10,'H',false),card('a',9),card('b',8)];
    if(!empty)g.cols[1]=[card('target',10,'H')];
    const before=plain(g);
    assert.equal(E.canMove(g,0,1,1),true);const res=E.move(g,0,1,1);
    assert.equal(res.ok,true);assert.equal(res.revealed,'covered');assert.deepEqual(plain(res.moved),['a','b']);
    assert.equal(g.cols[0][0].up,true);assert.equal(E.undo(g).ok,true);
    for(const key of ['cols','stock','completed','moves','history'])assert.deepEqual(plain(g[key]),before[key]);
  }
});

test('an invalid selected suffix cannot move to either a rank build or an empty column and mutates nothing',()=>{
  const {E}=harness(),g=position(E);g.cols[0]=[card('a',9),card('b',8,'S',false)];g.cols[1]=[card('target',10)];
  const before=plain(g);
  for(const to of [1,2]){assert.equal(E.canMove(g,0,0,to),false);assert.equal(E.move(g,0,0,to).ok,false);assert.deepEqual(plain(g),before);}
});

for(let index=0;index<13;index++) test(`checkSets: face-down card at K-A index ${index} leaves the entire state unchanged`,()=>{
  const {E}=harness(),g=position(E),sequence=run();sequence[index].up=false;
  g.cols[0]=[card('covered',4,'H',false),...sequence];const before=plain(g);
  assert.equal(E.checkSets(g).length,0);assert.deepEqual(plain(g),before);
});

for(const variant of ['incomplete','mixed-suit','rank-gap','wrong-king','wrong-ace'])test('checkSets rejects '+variant+' without removing/revealing/counting',()=>{
  const {E}=harness(),g=position(E),sequence=run();
  if(variant==='incomplete')sequence.pop();
  if(variant==='mixed-suit')sequence[6].suit='H';
  if(variant==='rank-gap')sequence[6].rank=5;
  if(variant==='wrong-king')sequence[0].rank=12;
  if(variant==='wrong-ace')sequence[12].rank=2;
  g.cols[0]=[card('covered',4,'H',false),...sequence];const before=plain(g);
  assert.equal(E.checkSets(g).length,0);assert.deepEqual(plain(g),before);
});

test('an unrelated legal move cannot settle or report rewards for an invalid K-A candidate',()=>{
  const {E}=harness(),g=position(E),sequence=run();sequence[12].up=false;
  g.cols[0]=[card('covered',4,'H',false),...sequence];g.cols[1]=[card('five',5)];g.cols[2]=[card('six',6,'H')];
  const before=plain(g.cols[0]),res=E.move(g,1,0,2);
  assert.equal(res.ok,true);assert.equal(res.completions.length,0);assert.equal(res.newSets,0);assert.equal(res.won,undefined);
  assert.equal(g.completed,0);assert.equal(g.bestCompleted,0);assert.equal(g.won,false);assert.deepEqual(plain(g.cols[0]),before);
});

test('multiple valid completions in one column and across columns remove only their own cards and reveal the predecessor',()=>{
  const {E}=harness(),g=position(E);
  g.cols[0]=[card('covered',5,'H',false),...run('one'),...run('two')];g.cols[1]=run('three','H');
  const beforeIds=new Set(g.cols.flat().map(c=>c.id)),completions=E.checkSets(g),removed=completions.flatMap(c=>c.cards);
  assert.equal(completions.length,3);assert.equal(g.completed,3);assert.equal(removed.length,39);
  assert.equal(new Set(removed.map(c=>c.id)).size,39);assert.equal(g.cols[0].length,1);assert.equal(g.cols[0][0].id,'covered');assert.equal(g.cols[0][0].up,true);
  assert.equal(completions.filter(c=>c.revealed==='covered').length,1);
  assert.deepEqual(new Set([...removed,...g.cols.flat()].map(c=>c.id)),beforeIds);
});

test('valid settlement of multiple sequences, undo and replay preserve the completion high-water mark',()=>{
  const {E}=harness(),g=position(E);g.completed=g.bestCompleted=5;
  g.cols[0]=run('one').slice(0,12);g.cols[1]=[card('ace',1)];g.cols[2]=run('two','H');
  const before=plain(g),res=E.move(g,1,0,0);
  assert.equal(res.completions.length,2);assert.equal(res.newSets,2);assert.equal(g.completed,7);assert.equal(g.bestCompleted,7);
  assert.equal(E.undo(g).ok,true);for(const k of ['cols','stock','completed','moves'])assert.deepEqual(plain(g[k]),before[k]);
  assert.equal(g.bestCompleted,7);const replay=E.move(g,1,0,0);assert.equal(replay.completions.length,2);assert.equal(replay.newSets,0);
});

test('hints, smartTarget and the internal search enumerator exclude every illegal suffix',()=>{
  const {E}=harness(),g=position(E);
  g.cols[0]=[card('nine',9),card('eight',8,'S',false),card('seven',7)];g.cols[1]=[card('ten',10,'H')];g.cols[2]=[card('target',8,'H')];
  const before=plain(g);
  assert.equal(E.smartTarget(g,0,0),-1);assert.equal(E.smartTarget(g,0,2),2);
  const hints=[E.hintBasic(g),...E.hints(g)].filter(Boolean);
  assert.ok(hints.some(m=>m.from===0&&m.idx===2));
  // Test-only closure instrumentation leaves the production API unchanged.
  const context=vm.createContext({});let source=readFileSync(resolve(root,'site/ember-solitaire/js/engine.js'),'utf8');
  const anchor='  root.ES.Engine = {';assert.ok(source.includes(anchor));
  source=source.replace(anchor,'  root.__searchForTest = { legalMoves };\n'+anchor);vm.runInContext(source,context);
  const search=context.__searchForTest.legalMoves(g);assert.ok(search.length>0);
  const moves=[...hints,...search.map(([from,idx,to])=>({from,idx,to}))];
  for(const m of moves){const selected=g.cols[m.from].slice(m.idx);assert.ok(selected.length);assert.ok(selected.every(c=>c.up));for(let i=1;i<selected.length;i++){assert.equal(selected[i-1].rank,selected[i].rank+1);assert.equal(selected[i-1].suit,selected[i].suit);}assert.equal(E.canMove(g,m.from,m.idx,m.to),true);assert.ok(!(m.from===0&&m.idx<2));}
  assert.deepEqual(plain(g),before);assert.equal(E.canAutoComplete(g),false);assert.equal(E.solveEndgame(g),null);
});

test('stuck search does not mistake lifting a face-down suffix for progress',()=>{
  const {E}=harness(),g=position(E);g.cols[0]=[card('nine',9),card('eight',8,'S',false)];g.cols[1]=[card('ten',10)];
  const before=plain(g);assert.equal(E.isStuck(g,2),true);assert.deepEqual(plain(g),before);
});

const archive=archiveFiles(readFileSync(resolve(root,'site-source.tar.gz')));
for(const suits of [1,2,4])test(`${suits}-suit seeded legal play/deal/undo matches historical behavior and conserves all cards`,()=>{
  const {E,context}=harness(),legacy=vm.createContext({Date:context.Date});
  vm.runInContext(archive.get('dist/ember-solitaire/js/engine.js').toString(),legacy);const old=legacy.ES.Engine;
  const g=E.newGame(suits,{seed:20261022}),prior=old.newGame(suits,{seed:20261022});assert.deepEqual(plain(g),plain(prior));
  function conserve(){const cards=[...g.cols.flat(),...g.stock];assert.equal(cards.length+g.completed*13,104);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);assert.deepEqual(plain(g),plain(prior));}
  for(let step=0;step<100;step++){
    conserve();assert.deepEqual(plain(E.hints(g)),plain(old.hints(prior)));
    const hint=E.hintBasic(g);let result,previous;
    if(step%11===0&&E.canDeal(g).ok){result=E.deal(g);previous=old.deal(prior);}
    else if(hint){result=E.move(g,hint.from,hint.idx,hint.to);previous=old.move(prior,hint.from,hint.idx,hint.to);}
    else break;
    assert.deepEqual(plain(result),plain(previous));conserve();
    if(step%7===0){assert.deepEqual(plain(E.undo(g)),plain(old.undo(prior)));conserve();}
  }
  conserve();
});

function canonicalEndgame(E,suits,daily=false){
  const g=E.newGame(suits,{seed:42,daily,dailyKey:daily?'2026-10-22':null});
  const sequence=E.newDeck(suits,()=>0).filter(c=>parseInt(c.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);sequence.forEach(c=>{c.up=true;});
  g.cols=[sequence.slice(0,12),sequence.slice(12),[],[],[],[],[],[],[],[]];g.stock=[];g.completed=g.bestCompleted=7;g.run=0;return g;
}
for(const suits of [1,2,4])test(`${suits}-suit solver plan stays legal through v2 save/reload and one daily/victory settlement`,()=>{
  const {E,S,storage}=harness();S.load();const g=canonicalEndgame(E,suits,true);S.startGame(g);assert.equal(S.persistence.unsaved,false);
  const id=g.settlement.handId,before=plain(g),plan=E.solveEndgame(g,1000);assert.ok(plan&&plan.length>0);assert.deepEqual(plain(g),before);
  for(const m of plan){assert.equal(E.canMove(g,m.from,m.idx,m.to),true);assert.ok(g.cols[m.from].slice(m.idx).every(c=>c.up));const res=E.move(g,m.from,m.idx,m.to);assert.equal(res.ok,true);S.applyResult(g,res);}
  assert.equal(g.completed,8);assert.equal(g.won,true);assert.equal(g.settlement.handId,id);assert.equal(g.settlement.victoryPaid,true);
  const expected=S.SET_REWARD+S.WIN_REWARD[suits]+S.DAILY_REWARD;assert.equal(S.state.embers,expected);assert.equal(S.state.stats.wins,1);assert.equal(S.state.stats.dailies,1);
  assert.equal(S.validateHand(g),true);assert.equal(S.save(true),true);const reload=harness(storage.get(S.KEY));reload.S.load();assert.equal(reload.S.persistence.blocked,false);assert.deepEqual(plain(reload.S.state),plain(S.state));
  const loaded=reload.S.state.game;assert.equal(reload.E.undo(loaded).ok,true);assert.equal(loaded.settlement.victoryPaid,true);const replay=reload.E.move(loaded,1,0,0);assert.equal(replay.newSets,0);reload.S.applyResult(loaded,replay);
  assert.equal(reload.S.state.embers,expected);assert.equal(reload.S.state.stats.wins,1);assert.equal(reload.S.save(true),true);
});

test('legal single-card moves accept rank builds and empty columns',()=>{
  for(const empty of [false,true]) {
    const {E}=harness(),g=position(E);g.cols[0]=[card('nine',9)];if(!empty)g.cols[1]=[card('ten',10,'H')];
    assert.equal(E.canMove(g,0,0,1),true);const res=E.move(g,0,0,1);assert.equal(res.ok,true);assert.deepEqual(plain(res.moved),['nine']);assert.equal(g.cols[0].length,0);assert.equal(g.cols[1].at(-1).id,'nine');assert.equal(g.cardsMoved,1);
  }
});

test('valid King-to-Ace sequences of every suit are removed exactly once',()=>{
  const {E}=harness();
  for(const suit of ['S','H','D','C']) {
    const g=position(E);g.cols[0]=run(suit,suit);const completed=E.checkSets(g);
    assert.equal(completed.length,1);assert.equal(completed[0].cards.length,13);assert.equal(g.cols[0].length,0);assert.equal(g.completed,1);assert.equal(E.checkSets(g).length,0);assert.equal(g.completed,1);
  }
});
