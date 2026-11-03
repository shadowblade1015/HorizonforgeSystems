import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {harness} from './helpers.mjs';
const code=readFileSync(new URL('../site/ember-solitaire/js/platform.js',import.meta.url),'utf8');
function native({future=false,conflict=false,missing=false}={}){
 const h=harness();h.S.load();h.S.save(true);const raw=h.storage.get(h.S.KEY),data=new Map([[h.S.KEY,future?'{"v":999,"keep":"future"}':conflict?JSON.stringify({...JSON.parse(raw),embers:900}):raw]]),fault={fail:false,hold:null},calls=[];
 const plugin={async keys(){return {keys:[...data.keys()]}},async get({key}){return {value:data.get(key)??null}},async set({key,value}){calls.push({key,value});if(fault.hold)await fault.hold;if(fault.fail)throw Error('disk denied');data.set(key,value)}};
 h.context.Capacitor={isNativePlatform:()=>true,isPluginAvailable:()=>!missing,registerPlugin:()=>plugin};
 vm.runInContext(code,h.context);return {...h,P:h.context.ES.Platform,data,fault,calls,raw};
}
test('native save stays pending until verified acknowledgement; backup and receipt are mirrored',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);let release;h.fault.hold=new Promise(r=>release=r);
 h.S.startGame(h.E.newGame(2,{seed:42}));h.S.addEmber(123);h.S.save(true);assert.equal(h.S.persistence.unsaved,true);assert.equal(h.S.persistence.code,'pending');
 release();assert.equal(await h.P.flush(),true);await Promise.resolve();assert.equal(h.S.persistence.code,'saved');
 assert.equal(JSON.parse(h.data.get(h.S.KEY)).totalEmber,123);assert.ok(JSON.parse(h.data.get(h.S.KEY)).game.settlement.handId);assert.ok(h.data.has(h.S.BACKUP_KEY));
});
test('concurrent native saves are ordered and latest acknowledgement wins',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);h.S.addEmber(10);h.S.save(true);h.S.addEmber(20);h.S.save(true);assert.equal(await h.P.flush(),true);
 const primary=h.calls.filter(c=>c.key===h.S.KEY).map(c=>JSON.parse(c.value).totalEmber);assert.deepEqual(primary,[10,30]);assert.equal(h.S.persistence.unsaved,false);
});
test('native write failure preserves prior primary and exports local progress; explicit retry works',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);h.fault.fail=true;h.S.addEmber(50);h.S.save(true);assert.equal(await h.P.flush(),false);assert.equal(h.data.get(h.S.KEY),h.raw);assert.equal(h.S.persistence.unsaved,true);assert.equal(JSON.parse(h.S.exportSave()).embers,50);
 h.fault.fail=false;assert.equal(await h.S.flushSave(),true);assert.equal(JSON.parse(h.data.get(h.S.KEY)).embers,50);
});
for(const option of ['future','conflict','missing'])test('native '+option+' fails closed without profile replacement',async()=>{
 const h=native({[option]:true}),before=h.data.get(h.S.KEY);assert.equal(await h.P.hydrate(h.S.KEY),false);assert.equal(h.storage.get(h.S.KEY),h.raw);h.S.save(true);assert.equal(await h.P.flush(),false);assert.equal(h.data.get(h.S.KEY),before);assert.equal(h.S.persistence.unsaved,true);
 if(option!=='missing')assert.ok(h.S.recoveryCopies().some(k=>h.S.exportRecovery(k)===before));
});
test('external native future-schema change blocks a queued write and preserves raw',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);const future='{"v":999,"keep":"external"}';h.data.set(h.S.KEY,future);h.S.save(true);assert.equal(await h.P.flush(),false);assert.equal(h.data.get(h.S.KEY),future);assert.ok(h.S.recoveryCopies().some(k=>h.S.exportRecovery(k)===future));
});
test('native hydration preserves conflicting backup/recovery raw copies',async()=>{
 const h=native();h.data.set(h.S.BACKUP_KEY,'native backup raw');h.storage.set(h.S.BACKUP_KEY,'local backup raw');h.data.set(h.S.RECOVERY_PREFIX+'old','native recovery raw');await h.P.hydrate(h.S.KEY);
 assert.equal(h.storage.get(h.S.BACKUP_KEY),'local backup raw');assert.equal(h.storage.get(h.S.RECOVERY_PREFIX+'old'),'native recovery raw');assert.ok(h.S.recoveryCopies().some(k=>h.S.exportRecovery(k)==='native backup raw'));
});
test('native WebViews without Web Locks remain read-only rather than silently bypassing ownership',async()=>{
 const h=native();h.S.releaseWriter();await h.P.flush();await Promise.resolve();h.context.navigator={};assert.equal(await h.S.acquireWriter(),false);assert.equal(await h.P.hydrate(h.S.KEY),false);assert.equal(h.S.save(true),false);
});
test('native save flush cannot acknowledge an unvalidated future browser profile',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);h.storage.set(h.S.KEY,'{"v":999}');assert.equal(await h.S.flushSave(),false);assert.equal(h.data.get(h.S.KEY),h.raw);
});

test('native release refuses edits but holds ownership until accepted OS writes settle',async()=>{
 const h=native();await h.P.hydrate(h.S.KEY);let release;h.fault.hold=new Promise(r=>release=r);h.S.addEmber(44);h.S.save(true);await Promise.resolve();await Promise.resolve();h.S.releaseWriter();assert.equal(h.S.canEdit,false);assert.equal(h.S.ownsWriter,true);assert.equal(await h.S.acquireWriter(),false);release();assert.equal(await h.P.flush(),true);await Promise.resolve();assert.equal(h.S.ownsWriter,false);assert.equal(JSON.parse(h.data.get(h.S.KEY)).embers,44);
});
