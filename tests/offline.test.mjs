import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {readTree,root} from '../tools/verify-source.mjs';
import {generate} from '../tools/release.mjs';
import {lifecycleHarness} from './lifecycle-helpers.mjs';
const template=readFileSync(new URL('../site/ember-solitaire/sw.js',import.meta.url),'utf8');
const scope='https://test.invalid/ember-solitaire/';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(letter='a') {
 const id=letter.repeat(64),base='/ember-solitaire/_releases/'+id+'/';
 const bytes=new Map([['index.html','<title>Game '+letter+'</title>'],['privacy.html','<title>Privacy</title>'],['js/engine.js','self.engine='+JSON.stringify(letter)],['optional.webp','optional art']]);
 return {id,base,bytes,files:[...bytes].map(([path,b])=>({path,sha256:sha(b),bytes:Buffer.byteLength(b),core:path!=='optional.webp'}))};
}
function cacheStorage() {
 const entries=new Map(),state={fail:false};
 const key=k=>typeof k==='string'?new URL(k,scope).href:k.url;
 return {entries,state,async keys(){return [...entries.keys()];},async delete(n){return entries.delete(n);},async open(n){if(state.openFail)throw Error('Denied');if(!entries.has(n))entries.set(n,new Map());const map=entries.get(n);return {async match(k){return map.get(key(k))?.clone();},async put(k,r){if(state.fail||state.failURL?.(key(k)))throw Error('QuotaExceededError');map.set(key(k),r.clone());},async keys(){return [...map.keys()].map(url=>({url}));},async delete(k){return map.delete(key(k));}};}};
}
function worker(release=fixture(),storage=cacheStorage()) {
 const handlers=new Map(),live=[],calls=[],state={skip:0,claim:0,network:'ok'};
 const self={registration:{scope},clients:{async matchAll(){return live;},async claim(){state.claim++;}},addEventListener:(n,f)=>handlers.set(n,f),async skipWaiting(){state.skip++;}};
 const context=vm.createContext({self,caches:storage,URL,Response,AbortController,crypto:webcrypto,setTimeout,clearTimeout,fetch:async url=>{calls.push(url);if(state.network==='throw')throw Error('Offline');if(state.delay)return new Promise((_,reject)=>setTimeout(()=>reject(Error('Interrupted')),10));const p=new URL(url).pathname.slice(release.base.length),b=release.bytes.get(p),r=new Response(state.badBody||b||'Missing',{status:state.status|| (b?200:404)});if(state.opaque)Object.defineProperty(r,'type',{value:'opaque'});if(state.redirected)Object.defineProperty(r,'redirected',{value:true});return r;}});
 vm.runInContext(template.replace('const RELEASE = null; // BUILD_RELEASE','const RELEASE = '+JSON.stringify(release)+';')+'\nself.test={install,retire,cacheRelease,PREFIX,CACHE,META,marker,pinURL,pendingURL};',context);
 const run=async (name,extra={})=>{const jobs=[];let response,reply;const event={request:{url:scope,method:'GET',mode:'navigate'},ports:[{postMessage:v=>{reply=v;}}],source:{id:'page',url:scope},waitUntil:p=>jobs.push(p),respondWith:p=>{response=p;},...extra};handlers.get(name)(event);if(response)response=await response;await Promise.all(jobs);return {response,reply,handled:!!response};};
 return {release,storage,state,live,calls,self,run,t:self.test};
}

test('release output is byte-deterministic, content-derived and has compatible base/SRI/worker paths',()=>{
 const source=readTree(root+'site'),a=generate(source),b=generate(source);
 assert.deepEqual(a.output,b.output);assert.match(a.release.id,/^[a-f0-9]{64}$/);
 const changed=new Map(source);changed.set('ember-solitaire/js/engine.js',Buffer.concat([source.get('ember-solitaire/js/engine.js'),Buffer.from('\n// fixture')]));assert.notEqual(generate(changed).release.id,a.release.id);
 const html=a.output.get('ember-solitaire/index.html').toString();assert.ok(html.includes('<base href="'+a.release.base+'">'));assert.equal([...html.matchAll(/<script /g)].length,[...html.matchAll(/<script [^>]+integrity="sha256-/g)].length);
 assert.ok(a.release.files.find(f=>f.path==='js/stuck-worker.js').core);assert.ok(a.release.files.find(f=>f.path==='js/engine.js').core);assert.equal(a.release.files.find(f=>f.path==='assets/cards/hearts/ace.webp').core,false);
 assert.equal(a.output.get('ember-solitaire/js/engine.js').equals(source.get('ember-solitaire/js/engine.js')),true);
});
test('offline core includes actual mode-picker faces and the default-back preview without downloading other suit decks',()=>{
 const source=readTree(root+'/site'),{release}=generate(source),context=vm.createContext({});
 vm.runInContext(source.get('ember-solitaire/js/manifest.js').toString(),context);
 const m=context.ES.Manifest,paths=[m.back('spade',true),...[[13,'S'],[12,'S'],[1,'S'],[13,'H'],[13,'C'],[13,'D']].map(([r,s])=>m.card(r,s,true))];
 for(const path of paths)assert.equal(release.files.find(f=>f.path===path)?.core,true,path);
 assert.equal(release.files.find(f=>f.path===m.card(1,'H')).core,false);
});
test('core installation is atomic, excludes optional assets, and never skips waiting',async()=>{const w=worker();await w.run('install');assert.equal(w.state.skip,0);assert.equal(w.calls.length,3);assert.ok(await w.t.cacheRelease(w.release.id));await w.run('activate');assert.equal(w.state.claim,1);});
for(const status of [404,500])test(`HTTP ${status} cannot produce a ready release or replace a cached success`,async()=>{const w=worker();w.state.status=status;await assert.rejects(w.run('install'));assert.equal(await w.t.cacheRelease(w.release.id),null);assert.equal(w.state.skip,0);});
test('content mismatch is rejected even with HTTP 200',async()=>{const w=worker();w.state.badBody='wrong release';await assert.rejects(w.run('install'),/mismatch/);assert.equal(await w.t.cacheRelease(w.release.id),null);});
for(const kind of ['opaque','redirected'])test(`${kind} response is rejected before it enters a release cache`,async()=>{const w=worker();w.state[kind]=true;await assert.rejects(w.run('install'),/Unsuitable/);assert.equal(await w.t.cacheRelease(w.release.id),null);});
for(const failure of ['fail','openFail'])test(`cache ${failure} prevents an installation without clearing other caches`,async()=>{const w=worker();await w.storage.open('unrelated-app');w.storage.state[failure]=true;await assert.rejects(w.run('install'));assert.ok((await w.storage.keys()).includes('unrelated-app'));});
test('interrupted install removes its partial cache; previous release remains usable',async()=>{const a=worker();a.live.push({id:'old',url:scope});await a.run('install');await a.run('message',{data:{type:'HELLO',id:a.release.id},source:a.live[0]});const b=worker(fixture('b'),a.storage);b.live.push(...a.live);b.state.delay=true;await assert.rejects(b.run('install'));assert.ok(await a.t.cacheRelease(a.release.id));assert.equal(await b.t.cacheRelease(b.release.id),null);});
test('offline aliases and privacy are distinct, unknown navigation is 404, network waits are avoided',async()=>{const w=worker();await w.run('install');w.state.network='throw';for(const path of ['', 'index.html'])assert.match(await(await w.run('fetch',{request:{url:scope+path,method:'GET',mode:'navigate'}})).response.text(),/Game/);assert.match(await(await w.run('fetch',{request:{url:scope+'privacy.html',method:'GET',mode:'navigate'}})).response.text(),/Privacy/);assert.equal((await w.run('fetch',{request:{url:scope+'unknown',method:'GET',mode:'navigate'}})).response.status,404);assert.equal(w.calls.length,3);});
test('non-GET requests are never intercepted or cached',async()=>{const w=worker();assert.equal((await w.run('fetch',{request:{url:scope,method:'POST',mode:'navigate'}})).handled,false);assert.equal(w.calls.length,0);});
for(const url of ['https://third.invalid/file.js','https://test.invalid/about/'])test(`does not intercept unrelated URL ${url}`,async()=>{const w=worker();assert.equal((await w.run('fetch',{request:{url,method:'GET'}})).handled,false);});
test('optional failures do not corrupt core and quota failures cannot report a complete artwork download',async()=>{const w=worker();await w.run('install');w.state.status=500;let r=await w.run('message',{data:{type:'DOWNLOAD'}});assert.equal(r.reply.ok,false);assert.ok(await w.t.cacheRelease(w.release.id));w.state.status=200;w.storage.state.failURL=u=>u.endsWith('optional.webp');r=await w.run('message',{data:{type:'DOWNLOAD'}});assert.equal(r.reply.failed,1);w.storage.state.failURL=null;r=await w.run('message',{data:{type:'DOWNLOAD'}});assert.equal(r.reply.ok,true);});
test('runtime writes belong to event, are finite and cached success survives subsequent network errors',async()=>{const w=worker();await w.run('install');const req={url:'https://test.invalid'+w.release.base+'optional.webp?ignored=1',method:'GET'};let r=await w.run('fetch',{request:req});assert.equal(r.response.status,200);const n=w.calls.length;w.state.status=500;r=await w.run('fetch',{request:req});assert.equal(await r.response.text(),'optional art');assert.equal(w.calls.length,n);req.url='https://test.invalid'+w.release.base+'unapproved.webp';assert.equal((await w.run('fetch',{request:req})).response.status,404);});
test('evicted core produces an explicit unavailable response, never a different release',async()=>{const w=worker();await w.run('install');await(await w.storage.open(w.t.CACHE)).delete(new URL(w.release.base+'js/engine.js',scope).href);w.state.network='throw';assert.equal((await w.run('fetch',{request:{url:new URL(w.release.base+'js/engine.js',scope).href,method:'GET'}})).response.status,503);assert.equal((await w.run('message',{data:{type:'STATUS'}})).reply.ok,false);});
test('activation refuses unidentified legacy tabs and does not delete their caches',async()=>{const w=worker();await w.run('install');w.live.push({id:'legacy',url:scope});await w.storage.open('ember-solitaire:'+encodeURIComponent(scope)+':old');let r=await w.run('message',{data:{type:'ACTIVATE',id:w.release.id}});assert.equal(r.reply.ok,false);assert.equal(w.state.skip,0);w.live.length=0;r=await w.run('message',{data:{type:'ACTIVATE',id:w.release.id}});assert.equal(r.reply.ok,true);assert.equal(w.state.skip,1);});
test('multiple identified release clients pin A through B takeover and A retires only after its clients close',async()=>{const a=worker();a.live.push({id:'old',url:scope});await a.run('install');await a.run('message',{data:{type:'HELLO',id:a.release.id},source:a.live[0]});const b=worker(fixture('b'),a.storage);b.live.push(...a.live,{id:'new',url:scope});await b.run('install');await b.run('message',{data:{type:'HELLO',id:b.release.id},source:b.live[1]});assert.equal((await b.run('message',{data:{type:'ACTIVATE',id:b.release.id},source:b.live[1]})).reply.ok,true);await b.run('activate');assert.ok(await b.t.cacheRelease(a.release.id));b.live.shift();await b.t.retire();assert.equal(await b.t.cacheRelease(a.release.id),null);assert.ok(await b.t.cacheRelease(b.release.id));});
test('waiting release is retained by active-worker retirement and rollback reuse does not overwrite a live cache',async()=>{const a=worker();a.live.push({id:'a',url:scope});await a.run('install');await a.run('message',{data:{type:'HELLO',id:a.release.id},source:a.live[0]});const b=worker(fixture('b'),a.storage);b.live.push(...a.live);await b.run('install');await a.t.retire();assert.ok(await b.t.cacheRelease(b.release.id));a.state.network='throw';await a.run('install');assert.ok(await a.t.cacheRelease(a.release.id));});
test('unknown clients prevent cleanup and a fifth retained release is refused, bounding cache growth',async()=>{const w=worker(fixture('e'));w.live.push({id:'unknown',url:scope});for(const c of ['a','b','c','d'])await w.storage.open(w.t.PREFIX+c.repeat(64));await assert.rejects(w.run('install'),/Close old/);assert.equal((await w.storage.keys()).filter(n=>/[a-f0-9]{64}$/.test(n)).length,4);});
test('a failed upgrade with no open tabs preserves the previous active offline release',async()=>{const a=worker();await a.run('install');await a.run('activate');const b=worker(fixture('b'),a.storage);b.state.network='throw';await assert.rejects(b.run('install'));assert.ok(await a.t.cacheRelease(a.release.id));assert.equal(await b.t.cacheRelease(b.release.id),null);});
test('retirement cannot delete a candidate created after its keep metadata snapshot',async()=>{
 const a=worker();await a.run('install');await a.run('activate');const original=a.storage.open.bind(a.storage),candidate=a.t.PREFIX+'b'.repeat(64);let interleaved=false;
 a.storage.open=async name=>{const c=await original(name);if(name!==a.t.META)return c;return {...c,async match(url){const r=await c.match(url);if(url===a.t.pendingURL&&!interleaved){interleaved=true;await c.put(a.t.pendingURL,new Response('b'.repeat(64)));await original(candidate);}return r;}};};
 await a.t.retire();assert.equal(interleaved,true);assert.ok((await a.storage.keys()).includes(candidate));assert.ok(await a.t.cacheRelease(a.release.id));
});
test('install publishes its pending protection before the candidate cache becomes visible',async()=>{
 const w=worker(),original=w.storage.open.bind(w.storage);let checked=false;
 w.storage.open=async name=>{if(name===w.t.CACHE){const meta=await original(w.t.META),pending=await meta.match(w.t.pendingURL);assert.equal(await pending?.text(),w.release.id);checked=true;}return original(name);};
 await w.run('install');assert.equal(checked,true);assert.ok(await w.t.cacheRelease(w.release.id));
});
test('CacheStorage read denial still permits hash-verified online resources without pretending they are stored',async()=>{const w=worker();await w.run('install');w.storage.state.openFail=true;const r=await w.run('fetch',{request:{url:new URL(w.release.base+'js/engine.js',scope).href,method:'GET'}});assert.equal(r.response.status,200);assert.match(await r.response.text(),/engine/);});
test('explicit repair restores partial and complete core eviction without deleting valid unrelated content',async()=>{const w=worker();await w.run('install');await(await w.storage.open(w.t.CACHE)).delete(new URL(w.release.base+'js/engine.js',scope).href);assert.equal((await w.run('message',{data:{type:'STATUS'}})).reply.ok,false);assert.equal((await w.run('message',{data:{type:'REPAIR'}})).reply.ok,true);assert.equal((await w.run('message',{data:{type:'STATUS'}})).reply.ok,true);await w.storage.delete(w.t.CACHE);assert.equal((await w.run('message',{data:{type:'REPAIR'}})).reply.ok,true);assert.equal((await w.run('message',{data:{type:'STATUS'}})).reply.ok,true);});
test('non-game source changes leave the game release ID unchanged and input insertion order is irrelevant',()=>{const source=readTree(root+'site'),a=generate(source),b=new Map([...source].reverse());b.set('about/audit.txt',Buffer.from('fixture'));assert.equal(generate(b).release.id,a.release.id);});

function client({legacy=false,bridge=false}={}) {
 const h=lifecycleHarness();h.start();h.clock.advance(16);const listeners=new Map(),a='a'.repeat(64),b='b'.repeat(64),calls=[];let reloads=0;
 class Channel {constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))};}}
 const make=id=>({id,scriptURL:scope+'sw.js?emberProtocol=1',postMessage(data,ports){calls.push(data);ports?.[0]?.postMessage(data.type==='STATUS'?{ok:true,id,legacyClients:legacy?1:0}:data.type==='ACTIVATE'?{ok:!legacy,id,reason:'Close older tabs'}:{ok:true});}});
 const active=make(a),waiting=make(b),reg={active,waiting,addEventListener(){},async update(){}};
 h.context.navigator={serviceWorker:{controller:active,async register(){return reg;},addEventListener:(n,f)=>listeners.set(n,f)}};
 h.context.URL=URL;h.context.MessageChannel=Channel;h.context.location={protocol:'https:',origin:'https://test.invalid',search:'',reload(){reloads++;}};
 h.get('meta[name="ember-release"]').content=bridge?b:a;h.get('meta[name="ember-scope"]').content='/ember-solitaire/';h.load('offline');
 return {...h,active,api:h.context.ES.Offline,calls,reg,async takeover(){reg.waiting=null;h.context.navigator.serviceWorker.controller=waiting;listeners.get('controllerchange')();for(let i=0;i<20;i++)await Promise.resolve();},get reloads(){return reloads;}};
}

function capabilityClient({core=true,artwork=false,download=true,repair=true,wrong=false,silent=false}={}) {
 const h=client();h.reg.waiting=null;let complete=artwork;
 h.active.postMessage=(data,ports)=>{
  h.calls.push(data);let reply={ok:true};
  if(data.type==='STATUS'){if(silent)return;reply={ok:core,artworkOk:complete,id:(wrong?'b':'a').repeat(64)};}
  if(data.type==='DOWNLOAD'){reply={ok:download};if(download)complete=true;}
  if(data.type==='REPAIR'){reply={ok:repair};if(repair)core=true;}
  ports?.[0]?.postMessage(reply);
 };
 return {...h,message:()=>h.document.querySelector('.offline-status').children[0].textContent};
}
test('STATUS separates core launch capability from optional artwork availability',async()=>{
 const w=worker();await w.run('install');let s=(await w.run('message',{data:{type:'STATUS'}})).reply;
 assert.equal(s.ok,true);assert.equal(s.artworkOk,false);
 await w.run('message',{data:{type:'DOWNLOAD'}});s=(await w.run('message',{data:{type:'STATUS'}})).reply;assert.equal(s.artworkOk,true);
 await(await w.storage.open(w.t.CACHE)).delete(new URL(w.release.base+'js/engine.js',scope).href);
 s=(await w.run('message',{data:{type:'STATUS'}})).reply;assert.equal(s.ok,false);assert.equal(s.artworkOk,true);
});
for(const core of [true,false])for(const download of [true,false])test(`artwork download core=${core} success=${download} reports verified capability`,async()=>{
 const h=capabilityClient({core,download});await h.api.start();await h.api.downloadAll();
 assert.match(h.message(),core?(download?/all supported modes/:/Some optional artwork/):/Repair offline files/);
 if(!core)assert.doesNotMatch(h.message(),/available offline|Offline ready:/);
 assert.equal(h.calls.filter(c=>c.type==='STATUS').length,3);
});
test('core-ready initial status describes optional incompleteness and completed artwork separately',async()=>{
 for(const artwork of [false,true]){const h=capabilityClient({artwork});await h.api.start();assert.match(h.message(),artwork?/all supported modes/:/Other artwork needs/);}
});
for(const repair of [true,false])test(`repair success=${repair} never invents readiness`,async()=>{
 const h=capabilityClient({core:false,repair});await h.api.start();await h.api.repair();assert.match(h.message(),repair?/Offline ready:/:/could not complete/);
});
test('successful REPAIR acknowledgement still needs a fresh ready STATUS',async()=>{
 const h=capabilityClient({core:false});const original=h.active.postMessage;
 h.active.postMessage=(data,ports)=>data.type==='REPAIR'?ports[0].postMessage({ok:true}):original(data,ports);
 await h.api.start();await h.api.repair();assert.match(h.message(),/Core offline files are incomplete/);
});
test('wrong-release STATUS refuses downloads and repair',async()=>{
 const h=capabilityClient({wrong:true});await h.api.start();await h.api.downloadAll();assert.match(h.message(),/could not be verified/);await h.api.repair();
 assert.equal(h.calls.some(c=>['DOWNLOAD','REPAIR'].includes(c.type)),false);
});
test('STATUS timeout cannot promise offline readiness',async()=>{
 const h=capabilityClient();await h.api.start();h.active.postMessage=()=>{};
 const pending=h.api.downloadAll();h.clock.advance(12001);await pending;assert.match(h.message(),/could not be verified/);assert.doesNotMatch(h.message(),/available offline/);
});
test('post-download STATUS failure preserves the download uncertainty instead of claiming all modes',async()=>{
 const h=capabilityClient();await h.api.start();const original=h.active.postMessage;let downloaded=false;
 h.active.postMessage=(data,ports)=>{if(data.type==='DOWNLOAD')downloaded=true;if(data.type==='STATUS'&&downloaded)ports[0].postMessage({id:'b'.repeat(64),ok:true,artworkOk:true});else original(data,ports);};
 await h.api.downloadAll();assert.match(h.message(),/Artwork may have downloaded/);assert.doesNotMatch(h.message(),/available offline/);
});
test('Later integrates with shared focus restoration and retains polite status semantics',async()=>{
 const h=capabilityClient();await h.api.start();const invoker=new h.Element('button');h.get('#scr-game').appendChild(invoker);invoker.focus();await h.api.check();
 const banner=h.document.querySelector('.offline-status'),later=banner.children.find(b=>b.textContent==='Later');banner.contains=node=>banner.children.includes(node);
 assert.equal(banner.children[0].getAttribute('role'),'status');later.focus();h.api.defer();assert.equal(banner.hidden,true);assert.equal(h.document.activeElement,invoker);assert.equal(h.reloads,0);assert.equal(h.calls.some(c=>c.type==='ACTIVATE'),false);
});
test('update deferral never reloads or activates; approval flushes save and holds input until own takeover',async()=>{const h=client();await h.api.start();assert.equal(h.api.target,'b'.repeat(64));h.api.defer();assert.equal(h.reloads,0);assert.equal(h.calls.some(c=>c.type==='ACTIVATE'),false);await h.api.approve();assert.equal(h.S.persistence.unsaved,false);assert.equal(h.debug.holds.size,1);await h.takeover();assert.equal(h.reloads,1);});
test('failed save blocks activation/reload and releases the update hold',async()=>{const h=client();await h.api.start();assert.equal(h.api.target,'b'.repeat(64));h.context.localStorage.setItem=()=>{throw Error('Write denied');};assert.equal(await h.api.approve(),false);assert.equal(h.reloads,0);assert.equal(h.calls.some(c=>c.type==='ACTIVATE'),false);assert.equal(h.debug.holds.size,0);});
test('another tab activating a worker never automatically reloads this tab',async()=>{const h=client();await h.api.start();await h.takeover();assert.equal(h.reloads,0);});
test('read-only tab cannot approve an update or claim pending ownership as a durable save',async()=>{const h=client();await h.api.start();const raw=h.storage.get(h.S.KEY);h.S.releaseWriter();h.context.navigator.locks={request(){return new Promise(()=>{})}};h.S.acquireWriter();assert.equal(await h.api.approve(),false);assert.equal(h.reloads,0);assert.equal(h.calls.some(c=>c.type==='ACTIVATE'),false);assert.equal(h.debug.holds.size,0);assert.equal(h.storage.get(h.S.KEY),raw);assert.notEqual(h.S.persistence.code,'saved');});
test('future schema protection blocks approval without replacing the original saved value',async()=>{const h=client(),raw='{"v":999,"embers":1234}';h.storage.set(h.S.KEY,raw);h.S.load();await h.api.start();assert.equal(await h.api.approve(),false);assert.equal(h.reloads,0);assert.equal(h.storage.get(h.S.KEY),raw);assert.equal(h.debug.holds.size,0);});
test('legacy-client refusal keeps this tab running and releases its update hold',async()=>{const h=client({legacy:true});await h.api.start();assert.equal(await h.api.approve(),false);assert.equal(h.reloads,0);assert.equal(h.debug.holds.size,0);});
test('a verified legacy bridge reloads only its already-loaded waiting bundle, without unsupported legacy RPC',async()=>{const h=client({bridge:true});h.reg.active.scriptURL=scope+'sw.js';h.reg.active.postMessage=()=>{throw Error('Legacy worker cannot reply');};await h.api.start();assert.equal(h.api.target,'b'.repeat(64));assert.equal(await h.api.approve(),true);assert.equal(h.S.persistence.unsaved,false);assert.equal(h.reloads,1);await h.takeover();assert.equal(h.reloads,1);});
