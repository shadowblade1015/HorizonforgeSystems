import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,plain,card,position} from './helpers.mjs';
for(const suits of [1,2,4]) {
 test(`${suits} suits: exact rank order, identity and immutable rejection`,()=>{
  const {E}=harness(),g=position(E);g.suits=suits;
  assert.deepEqual(Array.from({length:13},(_,i)=>E.rankLabel(13-i)),['K','Q','J','10','9','8','7','6','5','4','3','2','A']);
  for(const rank of [7,6,9]) {g.cols[0]=[card('s',7)];g.cols[1]=[card('d',rank)];const before=plain(g);assert.equal(E.move(g,0,0,1).ok,false);assert.deepEqual(plain(g),before);}
  for(const idx of [-1,.5,NaN,Infinity]){const before=plain(g);assert.equal(E.move(g,0,idx,1).ok,false);assert.deepEqual(plain(g),before);}
  const other=suits===1?'S':'H';g.cols[0]=[card('s',7)];g.cols[1]=[card('d',8,other)];assert.equal(E.move(g,0,0,1).ok,true);
  g.cols[0]=[card('a',7),card('b',6)];g.cols[1]=[card('d',8,other)];assert.equal(E.move(g,0,0,1).ok,true);
  if(suits>1){g.cols[0]=[card('a',7),card('b',6,other)];const before=plain(g);assert.equal(E.move(g,0,0,1).ok,false);assert.deepEqual(plain(g),before);}
 });
 test(`${suits} suits: completion, undo and reward high water`,()=>{
  const {E}=harness(),g=position(E);g.suits=suits;
  g.cols[0]=Array.from({length:12},(_,i)=>card('r'+i,13-i));g.cols[1]=[card('ace',1)];
  const result=E.move(g,1,0,0);assert.equal(result.newSets,1);assert.equal(g.cols[0].length,0);assert.equal(g.completed,1);
  assert.equal(E.undo(g).ok,true);assert.equal(E.move(g,1,0,0).newSets,0);
  for(const pair of [['S','C'],['H','D']]){g.cols[0]=Array.from({length:13},(_,i)=>card('r'+i,13-i,pair[i===6?1:0]));const before=plain(g);assert.equal(E.checkSets(g).length,0);assert.deepEqual(plain(g),before);}
 });
 test(`${suits} suits: hints prefer same suit and retain reveal moves`,()=>{
  const {E}=harness(),g=position(E);g.suits=suits;
  g.cols[0]=[card('down',10,'S',false),card('seven',7)];g.cols[1]=[card('mixed',8,'H')];g.cols[2]=[card('same',8)];
  const before=plain(g),hints=E.hints(g);assert.equal(hints[0].to,2);assert.ok(hints.some(h=>h.from===0&&h.to===1));
  for(const h of hints)assert.equal(E.canMove(g,h.from,h.idx,h.to),true);assert.deepEqual(plain(g),before);
 });
}
import {lifecycleHarness} from './lifecycle-helpers.mjs';
for(const suits of [1,2,4])for(const input of ['tap','drag','keyboard','one-tap'])test(`${suits} suits: ${input} commits the same legal move`,()=>{
 const h=lifecycleHarness({motion:false});const g=h.start(h.E.newGame(suits,{seed:42}));h.clock.advance(16);
 const m=h.E.hints(g)[0];assert.ok(m);const expected=plain(g);h.E.move(expected,m.from,m.idx,m.to);
 const n=h.debug.B.els.get(g.cols[m.from][m.idx].id),p=h.debug.B.pos.get(n.dataset.id),L=h.debug.B.L;
 const pointer=(target,x,y)=>({pointerId:1,pointerType:'mouse',button:0,target,clientX:x,clientY:y,preventDefault(){}});
 const send=(type,e)=>h.get('#board').dispatch(type,e);
 if(input==='drag') {const e=pointer(n,p.x+10,200),drop={...e,clientX:L.cols[m.to].x+10,clientY:220};send('pointerdown',e);send('pointermove',drop);h.clock.advance(16);send('pointerup',drop);}
 if(input==='tap') {const e=pointer(n,p.x+10,p.y+10);send('pointerdown',e);send('pointerup',e);h.debug.B.a11y[m.to].dispatch('click');}
 if(input==='keyboard') {h.B.select(m.from,m.idx);h.debug.B.kb.col=m.to;h.keydown({key:'Enter'});}
 if(input==='one-tap') {h.S.state.settings.oneTap=true;const target=h.E.smartTarget(g,m.from,m.idx);const expectedSmart=plain(g);h.E.move(expectedSmart,m.from,m.idx,target);const e=pointer(n,p.x+10,p.y+10);send('pointerdown',e);send('pointerup',e);assert.deepEqual(plain(g.cols),plain(expectedSmart.cols));assert.equal(g.moves,1);return;}
 assert.equal(g.moves,1);assert.deepEqual(plain(g.cols),plain(expected.cols));
});
for(const suits of [1,2,4])test(`${suits} suits: hint source/destination and 2600ms lifecycle`,()=>{
 const h=lifecycleHarness({motion:false});h.start(h.E.newGame(suits,{seed:917}));h.clock.advance(16);
 const hint=h.E.hints(h.B.game)[0];h.B.doHint();
 for(const c of h.B.game.cols[hint.from].slice(hint.idx))assert.equal(h.debug.B.els.get(c.id).classList.contains('hint-src'),true);
 assert.equal(h.debug.B.hls[hint.to].classList.contains('hint-dst'),true);
 h.clock.advance(2300);assert.equal(h.debug.B.hls[hint.to].classList.contains('hint-dst'),true);
 h.clock.advance(301);assert.equal(h.debug.B.hls[hint.to].classList.contains('hint-dst'),false);
});
