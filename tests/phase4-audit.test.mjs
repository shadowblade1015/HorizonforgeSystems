import test from 'node:test';
import assert from 'node:assert/strict';
import {harness, plain} from './helpers.mjs';
import {lockWorld} from './locks-helpers.mjs';

// Phase 4.1 converts the three retained Phase 4 loss reproductions into
// preservation assertions. Original pre-fix evidence remains in phase4/.
function tabs() {
  const seed=harness();seed.S.load();seed.S.save(true);
  const data = new Map([[seed.S.KEY,seed.storage.get(seed.S.KEY)]]), locks=lockWorld();
  const localStorage = {
    get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v)
  };
  const open = () => { const h = harness(null,{globals:{localStorage,navigator:{locks:locks.endpoint()}}}); h.S.load(); return h; };
  return {data, A: open(), B: open()};
}
test('P4-01 stale tab cannot replace earned Ember or the existing backup',()=>{
  const {data,A,B} = tabs();
  A.S.addEmber(100,'audit'); assert.equal(A.S.save(true),true);
  assert.equal(JSON.parse(data.get(A.S.KEY)).totalEmber,100);
  const backup=data.get(A.S.BACKUP_KEY);
  B.S.state.settings.music=0; assert.equal(B.S.save(true),false);
  assert.equal(JSON.parse(data.get(A.S.KEY)).totalEmber,100);
  assert.equal(data.get(A.S.BACKUP_KEY),backup);
  assert.notEqual(B.S.persistence.code,'saved');assert.equal(B.S.persistence.blocked,true);
});
test('P4-01 stale lifecycle save preserves another tab active hand and backup',()=>{
  const {data,A,B}=tabs(); A.S.startGame(A.E.newGame(2,{seed:42}));
  assert.notEqual(JSON.parse(data.get(A.S.KEY)).game,null);
  const primary=data.get(A.S.KEY),backup=data.get(A.S.BACKUP_KEY);
  assert.equal(B.S.save(true),false);
  assert.equal(data.get(A.S.KEY),primary);assert.equal(data.get(A.S.BACKUP_KEY),backup);
});
test('P4-01 already-running writer refuses and retains a newly stored future schema',()=>{
  const {data,A}=tabs(); const future='{"v":99,"savedAt":9999999999999,"futureProgress":"preserve me"}';
  const backup=data.get(A.S.BACKUP_KEY);
  data.set(A.S.KEY,future); assert.equal(A.S.save(true),false);
  assert.equal(data.get(A.S.KEY),future);assert.equal(data.get(A.S.BACKUP_KEY),backup);
  assert.equal(A.S.persistence.code,'conflict');
  assert.equal(A.S.recoveryCopies().some(k=>A.S.exportRecovery(k)===future),true);
});
test('Phase4 independent seeded legal play/undo preserves validated card and save invariants',()=>{
  for(const suits of [1,2,4]) for(const seed of [1,7,42,301]) {
    const {E,S}=harness();S.load();S.selectArtifact('sword');const g=E.newGame(suits,{seed});S.startGame(g);
    const rng=E.mulberry32(seed+919);
    for(let n=0;n<60&&!g.won;n++) {
      const moves=[];
      for(let from=0;from<10;from++)for(let idx=0;idx<g.cols[from].length;idx++)for(let to=0;to<10;to++)
        if(E.canMove(g,from,idx,to))moves.push([from,idx,to]);
      if(n%11===10&&g.history.length) E.undo(g);
      else if(n%9===8&&E.canDeal(g).ok)S.applyResult(g,E.deal(g));
      else if(moves.length){const m=moves[Math.floor(rng()*moves.length)];S.applyResult(g,E.move(g,...m));}
      else if(E.canDeal(g).ok)S.applyResult(g,E.deal(g));else break;
      assert.equal(S.validateHand(g),true,`suits=${suits} seed=${seed} step=${n}`);
      const before=plain(S.state);assert.equal(S.save(true),true);
      assert.deepEqual(plain(S.state),before);
      const reloaded=harness(S.exportSave());reloaded.S.load();
      assert.equal(reloaded.S.persistence.blocked,false);
      const persisted=plain(S.state);persisted.game.history=persisted.game.history.slice(-20);
      assert.deepEqual(plain(reloaded.S.state),persisted);
    }
  }
});
