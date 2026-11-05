import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {harness,plain} from './helpers.mjs';
import {lockWorld} from './locks-helpers.mjs';

const turn=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function origin({deferred=false}={}) {
 const seed=harness();seed.S.load();seed.S.save(true);
 const data=new Map(seed.storage),locks=lockWorld({deferred}),fault={};
 const localStorage={get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem(k){if(fault.read)throw Error('denied');return data.get(k)??null},setItem(k,v){if(fault.write||fault.key===k)throw Error('quota');data.set(k,v)}};
 const open=(extra={})=>{const h=harness(null,{acquire:!deferred,globals:{localStorage,navigator:{locks:locks.endpoint()},...extra}});h.S.load();return h;};
 return {data,locks,fault,open};
}
test('exclusive ifAvailable acquisition admits exactly one concurrent writer and grants no writes before load',async()=>{
 const o=origin({deferred:true}),a=o.open(),b=o.open();
 const results=await Promise.all([a.S.acquireWriter(),b.S.acquireWriter()]);assert.deepEqual(results,[true,false]);
 assert.equal(a.S.save(true),false);a.S.load();assert.equal(a.S.save(true),true);
 assert.equal(b.S.save(true),false);assert.equal(b.S.persistence.writer,false);
});
test('ownership is mandatory when Locks is absent, rejects or is still pending',async()=>{
 for(const navigator of [{},{locks:{request(){throw Error('denied')}}},{locks:{request(){return Promise.reject(Error('denied'))}}}]){
  const h=harness(null,{globals:{navigator}});await turn();h.S.load();const before=[...h.storage];
  assert.equal(h.S.canEdit,false);assert.equal(h.S.save(true),false);assert.equal(h.S.reset(),false);
  assert.equal(h.S.importSave('{"v":2}'),false);assert.equal(h.S.startGame(h.E.newGame(1)),false);
  assert.deepEqual([...h.storage],before);assert.equal(h.S.persistence.blocked,true);assert.notEqual(h.S.persistence.code,'saved');
 }
 const o=origin({deferred:true}),h=o.open();const pending=h.S.acquireWriter();assert.equal(h.S.save(true),false);await pending;h.S.load();assert.equal(h.S.save(true),true);
});
test('hung lock acquisition is bounded and late callbacks cannot grant ownership',async()=>{
 let callback;const tasks=new Map();let serial=0;
 const h=harness(null,{acquire:false,globals:{navigator:{locks:{request(n,o,fn){callback=fn;return new Promise(()=>{})}}},setTimeout(fn){tasks.set(++serial,fn);return serial},clearTimeout(id){tasks.delete(id)}}});
 const result=h.S.acquireWriter();[...tasks.values()][0]();assert.equal(await result,false);callback({name:'late'});h.S.load();assert.equal(h.S.canEdit,false);assert.equal(h.S.save(true),false);
});
test('release and successor acquisition reload the latest hand instead of saving stale memory',async()=>{
 const o=origin(),a=o.open(),b=o.open();a.S.startGame(a.E.newGame(2,{seed:42}));a.S.addEmber(100);a.S.save(true);
 assert.equal(await b.S.resumeEditing(),false);a.S.releaseWriter();await turn();
 assert.equal(await b.S.resumeEditing(),true);assert.equal(b.S.state.totalEmber,100);assert.equal(b.S.state.game.suits,2);
 assert.equal(b.S.save(true),true);assert.equal(a.S.save(true),false);assert.equal(a.S.canEdit,false);
});
test('a new document can obtain ownership after the old callback settles (crash/reload model)',async()=>{
 const o=origin(),a=o.open();a.S.addEmber(100);a.S.save(true);a.S.releaseWriter();await turn();
 const successor=o.open();assert.equal(successor.S.canEdit,true);assert.equal(successor.S.state.totalEmber,100);assert.equal(successor.S.save(true),true);
});
for(const path of ['save','import','reset'])test(path+' refuses conflicting raw without touching primary or backup',()=>{
 const o=origin(),a=o.open();a.S.addEmber(50);a.S.save(true);const backup=o.data.get(a.S.BACKUP_KEY),foreign=JSON.stringify({...a.S.state,embers:777,totalEmber:777});o.data.set(a.S.KEY,foreign);
 const before=plain(a.S.state),result=path==='save'?a.S.save(true):path==='import'?a.S.importSave('{"v":2,"embers":1}'):a.S.reset();
 assert.equal(result,false);assert.equal(o.data.get(a.S.KEY),foreign);assert.equal(o.data.get(a.S.BACKUP_KEY),backup);assert.deepEqual(plain(a.S.state),before);
 assert.equal(a.S.persistence.code,'conflict');assert.equal(a.S.persistence.blocked,true);
 assert.ok(a.S.recoveryCopies().some(k=>a.S.exportRecovery(k)===foreign));assert.ok(a.S.conflictMemory);
});
test('backup-only foreign edits are preserved, even when primary raw is unchanged',()=>{
 const o=origin(),a=o.open(),primary=o.data.get(a.S.KEY);o.data.set(a.S.BACKUP_KEY,'foreign-backup');assert.equal(a.S.save(true),false);
 assert.equal(o.data.get(a.S.KEY),primary);assert.equal(o.data.get(a.S.BACKUP_KEY),'foreign-backup');
});
for(const method of ['importSave','reset','acceptRecovery'])test(method+' rechecks raw after beforeSnapshot observers before replacing anything',()=>{
 const o=origin();if(method==='acceptRecovery')o.data.set('ember.save.v2','{"v":2,"embers":321,"game":{}}');const a=o.open(),future='{"v":99,"race":"keep"}',backup=o.data.get(a.S.BACKUP_KEY);
 let once=false;a.S.on(e=>{if(e.type==='beforeSnapshot'&&!once){once=true;o.data.set(a.S.KEY,future)}});
 assert.equal(method==='importSave'?a.S.importSave('{"v":2}'):a.S[method](),false);assert.equal(o.data.get(a.S.KEY),future);assert.equal(o.data.get(a.S.BACKUP_KEY),backup);
});
test('quarantine failure does not permit a conflict write; both copies remain exportable',()=>{
 const o=origin(),a=o.open(),future='{"v":99,"savedAt":999999,"privateFuture":"keep"}';o.data.set(a.S.KEY,future);o.fault.write=true;
 assert.equal(a.S.save(true),false);assert.equal(o.data.get(a.S.KEY),future);assert.equal(a.S.conflictStored,future);assert.ok(a.S.exportSave());assert.equal(a.S.exportStored(),future);
});
test('failed reads and primary/backup writes never claim saved and can retry safely under the same lock',()=>{
 for(const failure of ['read','primary','backup']){
  const o=origin(),a=o.open(),before=o.data.get(a.S.KEY);a.S.state.embers=123;
  if(failure==='read')o.fault.read=true;else o.fault.key=failure==='primary'?a.S.KEY:a.S.BACKUP_KEY;
  assert.equal(a.S.save(true),false);assert.equal(o.data.get(a.S.KEY),before);assert.equal(a.S.persistence.unsaved,true);assert.notEqual(a.S.persistence.code,'saved');
  o.fault.read=false;o.fault.key=null;assert.equal(a.S.save(true),true);assert.equal(JSON.parse(o.data.get(a.S.KEY)).embers,123);
 }
});
test('debounced pending write rechecks authority and raw at execution, not just at scheduling',()=>{
 const jobs=new Map();let serial=0;const o=origin(),a=o.open({setTimeout(fn){jobs.set(++serial,fn);return serial},clearTimeout(id){jobs.delete(id)}});
 a.S.state.embers=10;a.S.save();const future='{"v":99,"savedAt":555}';o.data.set(a.S.KEY,future);[...jobs.values()][0]();
 assert.equal(o.data.get(a.S.KEY),future);assert.equal(a.S.persistence.code,'conflict');
});
test('storage notification freezes the writer without being used as the lock',()=>{
 const events=new Map(),o=origin(),a=o.open({addEventListener:(n,f)=>events.set(n,f)});o.data.set(a.S.KEY,'{"v":99}');events.get('storage')({key:a.S.KEY});
 assert.equal(a.S.canEdit,false);assert.equal(a.S.save(true),false);assert.equal(o.data.get(a.S.KEY),'{"v":99}');
});
test('recovery acceptance requires ownership and cannot replace a changed original',()=>{
 const o=origin();o.data.set('ember.save.v2','{"v":2,"embers":321,"game":{}}');const a=o.open(),b=o.open();
 assert.equal(a.S.canRecover,true);assert.equal(b.S.acceptRecovery(),false);const foreign='{"v":99,"keep":1}';o.data.set(a.S.KEY,foreign);
 assert.equal(a.S.acceptRecovery(),false);assert.equal(o.data.get(a.S.KEY),foreign);
});
test('resume fails closed if this tab cannot be preserved before latest data reload',async()=>{
 const o=origin(),a=o.open(),b=o.open();a.S.releaseWriter();await turn();o.fault.write=true;
 assert.equal(await b.S.resumeEditing(),false);assert.equal(b.S.ownsWriter,false);assert.equal(b.S.save(true),false);
});
test('native hydration delegates to a locked validated restore and cannot replace future raw',async()=>{
 const o=origin(),a=o.open();o.data.set(a.S.KEY,'{"v":99,"savedAt":1}');a.S.load();const next=JSON.stringify({v:2,savedAt:999,embers:1});
 a.context.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>true,registerPlugin:()=>({get:async()=>({value:next})})};
 vm.runInContext(readFileSync(new URL('../site/ember-solitaire/js/platform.js',import.meta.url),'utf8'),a.context);
 await a.context.ES.Platform.hydrate(a.S.KEY);assert.equal(o.data.get(a.S.KEY),'{"v":99,"savedAt":1}');
 assert.equal(a.S.restoreNative(next),false);
});
test('supported native restore preserves the prior raw and cannot use a stale timestamp',()=>{
 const o=origin(),a=o.open(),before=o.data.get(a.S.KEY);const candidate=JSON.stringify({...JSON.parse(before),savedAt:Date.now()+1000,embers:99});
 assert.equal(a.S.restoreNative(candidate),true);assert.equal(a.S.state.embers,99);assert.ok(a.S.recoveryCopies().some(k=>a.S.exportRecovery(k)===before));
 assert.equal(a.S.restoreNative(before),false);assert.equal(a.S.state.embers,99);
});
