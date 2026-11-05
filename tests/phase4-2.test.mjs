import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {scheduler,lifecycleHarness} from './lifecycle-helpers.mjs';

function effects({reduced=false,legacy=false}={}) {
 const clock=scheduler(),win=new Map(),doc=new Map(),media=new Set();let draws=0,clears=0;
 const listen=(m,k,f)=>{if(!m.has(k))m.set(k,new Set());m.get(k).add(f);};
 const emit=(m,k)=>{for(const f of m.get(k)||[])f();};
 const style={setProperty(k,v){this[k]=v;}};
 const ctx={createRadialGradient:()=>({addColorStop(){}}),fillRect(){},clearRect(){clears++;},setTransform(){},drawImage(){draws++;}};
 const canvas=()=>({style:{},clientWidth:800,clientHeight:600,setAttribute(){},getContext:()=>ctx});
 const document={hidden:false,documentElement:{style},createElement:canvas,getElementById:()=>({appendChild(){}}),addEventListener:(k,f)=>listen(doc,k,f)};
 const mq={matches:reduced};mq[legacy?'addListener':'addEventListener']=legacy?f=>media.add(f):(k,f)=>media.add(f);
 const context=vm.createContext({document,matchMedia:()=>mq,performance:{now:()=>clock.now},requestAnimationFrame:clock.requestAnimationFrame,cancelAnimationFrame:clock.cancelAnimationFrame,addEventListener:(k,f)=>listen(win,k,f),ES:{Store:{state:{settings:{reduced:false}}}}});
 vm.runInContext(readFileSync(new URL('../site/ember-solitaire/js/fx.js',import.meta.url),'utf8'),context);
 return {clock,context,style,media,win,get draws(){return draws;},get clears(){return clears;},FX:context.ES.FX,
  reduce(value){mq.matches=value;for(const f of media)f({matches:value});},hide(value){document.hidden=value;emit(doc,'visibilitychange');},page:k=>emit(win,k)};
}
for(const legacy of [false,true])test(`dynamic OS motion cancels draws and stale frames; legacy listener=${legacy}`,()=>{
 const h=effects({legacy});h.FX.setField('home');h.clock.advance(32);assert.ok(h.draws>0);
 const stale=[...h.clock.tasks.values()][0].fn;h.style['--px']=1;h.reduce(true);const stopped=h.draws;
 stale();h.clock.advance(100);assert.equal(h.draws,stopped);assert.equal(h.clock.tasks.size,0);assert.equal(h.style['--px'],0);assert.ok(h.clears>0);
 h.reduce(false);h.clock.advance(32);assert.ok(h.draws>stopped);assert.equal(h.clock.tasks.size,1);assert.equal(h.media.size,1);
});
test('in-game reduction remains authoritative through OS toggles',()=>{
 const h=effects();h.context.ES.Store.state.settings.reduced=true;h.FX.setField('home');h.reduce(true);h.reduce(false);h.clock.advance(100);assert.equal(h.draws,0);assert.equal(h.clock.tasks.size,0);
 h.context.ES.Store.state.settings.reduced=false;h.FX.setField('home');h.clock.advance(32);assert.ok(h.draws>0);
});
test('repeated toggles and initialization have only one RAF and one parallax listener',()=>{
 const h=effects();h.FX.parallaxInit();h.FX.parallaxInit();assert.equal(h.win.get('pointermove').size,1);
 h.FX.setField('home');for(let i=0;i<20;i++){h.reduce(true);h.reduce(false);}assert.equal(h.clock.tasks.size,1);h.clock.advance(32);assert.equal(h.clock.tasks.size,1);
});
test('visibility and page lifecycle cannot resurrect an inactive field',()=>{
 const h=effects();h.FX.setField('home');h.clock.advance(32);h.hide(true);const n=h.draws;h.reduce(true);h.reduce(false);h.clock.advance(64);assert.equal(h.draws,n);
 h.hide(false);h.clock.advance(32);assert.ok(h.draws>n);h.page('pagehide');const stopped=h.draws;h.reduce(true);h.reduce(false);h.clock.advance(64);assert.equal(h.draws,stopped);
 h.FX.setField('none');h.page('pageshow');h.clock.advance(64);assert.equal(h.draws,stopped);assert.equal(h.clock.tasks.size,0);
 h.FX.setField('forge');h.clock.advance(32);assert.ok(h.draws>stopped);
});

function focusFixture(){
 const h=lifecycleHarness();h.UI.go('settings');const screen=h.get('#scr-settings'),invoker=new h.Element('button');screen.appendChild(invoker);
 // Model ancestor visibility/inertness, including transitions and disabled nodes.
 h.Element.prototype.closest=function(){for(let e=this;e;e=e.parent)if(e.hidden||e.inert||e['aria-hidden']==='true')return e;return null;};
 return {...h,invoker,screen};
}
test('shared focus helper restores the visible Settings invoker',()=>{
 const h=focusFixture(),owner=h.UI.captureScreenFocus(h.invoker);h.UI.restoreScreenFocus(owner);assert.equal(h.document.activeElement,h.invoker);
});
for(const invalid of ['hidden','inert','disabled','disconnected'])test(`notice focus excludes ${invalid} invoker`,()=>{
 const h=focusFixture(),owner=h.UI.captureScreenFocus(h.invoker),fallback=new h.Element('button');h.screen.appendChild(fallback);
 if(invalid==='disconnected')h.invoker.remove();else h.invoker[invalid]=true;
 h.UI.restoreScreenFocus(owner);assert.equal(h.document.activeElement,fallback);
});
test('automatic notice and rapid navigation choose only the current screen',()=>{
 const h=focusFixture(),old=h.UI.captureScreenFocus(h.invoker);h.UI.go('home');const next=new h.Element('button');h.get('#scr-home').appendChild(next);
 h.UI.restoreScreenFocus(old);assert.equal(h.document.activeElement,next);h.UI.restoreScreenFocus();assert.equal(h.document.activeElement,next);
});
test('notice dismissal cannot steal active modal focus',()=>{
 const h=focusFixture(),owner=h.UI.captureScreenFocus(h.invoker),dialog=new h.Element(),button=new h.Element('button');dialog.appendChild(button);h.get('#app').appendChild(dialog);
 const close=h.UI.modal(dialog,{title:'Save Recovery'});h.UI.restoreScreenFocus(owner);assert.equal(h.document.activeElement,button);close();
});
