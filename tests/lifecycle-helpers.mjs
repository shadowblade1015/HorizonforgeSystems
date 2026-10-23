import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {harness} from './helpers.mjs';

export function scheduler() {
  let now=0, serial=0;const tasks=new Map(), history=new Map();
  const add=(fn,ms,interval=0)=>{const id=++serial, task={fn,time:now+Math.max(0,ms),interval};tasks.set(id,task);history.set(id,task);return id;};
  return {
    get now(){return now;},tasks,history,
    setTimeout:(fn,ms=0)=>add(fn,ms),clearTimeout:id=>tasks.delete(id),
    setInterval:(fn,ms)=>add(fn,ms,ms),clearInterval:id=>tasks.delete(id),
    requestAnimationFrame:fn=>add(()=>fn(now),16),cancelAnimationFrame:id=>tasks.delete(id),
    advance(ms){const end=now+ms;let limit=10000;while(limit--){const next=[...tasks].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!next)break;const [id,t]=next;now=t.time;if(t.interval)t.time+=t.interval;else tasks.delete(id);t.fn();}if(limit<=0)throw Error('Scheduler loop');now=end;},
    get intervals(){return [...tasks.values()].filter(t=>t.interval).length;}
  };
}

export function lifecycleHarness(options={}) {
  const clock=scheduler(), animations=[], nodes=new Map(), windowEvents=new Map(), docEvents=new Map(), events=[];
  const listen=(map,key,fn)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(fn);};
  const emit=(map,key,event={})=>{for(const fn of [...map.get(key)||[]])fn(event);};
  class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.parent=null;this.dataset={};this.handlers=new Map();this.locals=new Map();this.classes=new Set();this.style={setProperty(k,v){this[k]=v;}};this.clientWidth=1000;this.clientHeight=700;this.offsetParent={};this.scrollTop=0;this.focuses=0;
      this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x),toggle:(x,flag)=>{const add=flag===undefined?!this.classes.has(x):flag;add?this.classes.add(x):this.classes.delete(x);return add;}};
    }
    set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}get className(){return [...this.classes].join(' ');}
    get isConnected(){return this.root||!!this.parent?.isConnected;}
    set innerHTML(value){this.html=value;for(const m of value.matchAll(/id="([^"]+)"/g)){const n=new Element('button');n.id=m[1];this.locals.set('#'+m[1],n);this.appendChild(n);}}
    get innerHTML(){return this.html||'';}
    appendChild(n){if(n.parent)n.remove();this.children.push(n);n.parent=this;return n;}
    append(...ns){ns.forEach(n=>this.appendChild(n));}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
    setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
    addEventListener(k,fn){listen(this.handlers,k,fn);}removeEventListener(k,fn){this.handlers.get(k)?.delete(fn);}dispatch(k,e={}){emit(this.handlers,k,e);}
    focus(){this.focuses++;document.activeElement=this;}
    getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
    setPointerCapture(){}releasePointerCapture(){}
    querySelector(s){if(this.locals.has(s))return this.locals.get(s);if(s.startsWith('#'))return nodes.get(s)||null;if(['svg.artifact-svg',':scope > .bg','h1, h2, .display','#vicStoke'].includes(s))return null;const n=new Element();this.locals.set(s,n);this.appendChild(n);return n;}
    querySelectorAll(s){if(s==='.stock-pile i')return [];if(s==='[data-icon]')return [];const cls=s.slice(1);return descendants(this).filter(n=>n.classList.contains(cls));}
    closest(s){return s.startsWith('.')&&this.classList.contains(s.slice(1))?this:null;}
    getAnimations(){return animations.filter(a=>a.node===this&&!a.done);}
    animate(frames,opts={}){const a={node:this,frames,opts,done:false,onfinish:null,cancel(){a.done=true;clock.clearTimeout(a.id);},finish(){if(a.done)return;a.done=true;clock.clearTimeout(a.id);a.onfinish?.();}};a.id=clock.setTimeout(()=>a.finish(),(opts.duration||0)+(opts.delay||0));animations.push(a);return a;}
  }
  function descendants(node){return node.children.flatMap(n=>[n,...descendants(n)]);}
  const app=new Element();app.root=true;nodes.set('#app',app);
  const get=s=>{if(!nodes.has(s)){const n=new Element();n.id=s.slice(1);nodes.set(s,n);app.appendChild(n);}return nodes.get(s);};
  for(const s of ['#board','#table','#gTime','#gMoves','#gSets','#gLive','#btnStock','#btnStock .stock-pile','#btnUndo','#btnHint','#btnFinish','#tabbar','#scr-game','#scr-home','#scr-modes','#scr-settings','#scr-forge'])get(s);
  const pips=Array.from({length:8},()=>{const n=new Element();get('#gSets').appendChild(n);return n;});
  const document={hidden:false,baseURI:'https://test.invalid/ember-solitaire/',activeElement:null,body:app,
    createElement:tag=>new Element(tag),getElementById:id=>get('#'+id),
    querySelector(s){if(s.startsWith('.'))return descendants(app).find(n=>s.split(',').some(c=>n.classList.contains(c.trim().slice(1))))||null;return get(s);},
    querySelectorAll:s=>s==='#gSets .pip'?pips:[],addEventListener:(k,fn)=>listen(docEvents,k,fn),removeEventListener:(k,fn)=>docEvents.get(k)?.delete(fn)};
  const workers=[];
  class Worker {constructor(){this.requests=[];workers.push(this);}postMessage(d){this.requests.push(d);}terminate(){this.terminated=true;}}
  const h=harness(null,{globals:{document,performance:{now:()=>clock.now},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,setInterval:clock.setInterval,clearInterval:clock.clearInterval,requestAnimationFrame:clock.requestAnimationFrame,cancelAnimationFrame:clock.cancelAnimationFrame,addEventListener:(k,fn)=>listen(windowEvents,k,fn),Worker,innerWidth:1000,innerHeight:700}});
  const es=h.context.ES;
  es.Audio={play:n=>events.push(['audio',n]),haptic(){},unlock(){},apply(){}};
  es.Icons={icon:()=>''};es.FX={motion:()=>options.motion!==false,sparks(){events.push(['sparks']);},setField(){}};
  es.Analytics={log:(...args)=>events.push(['analytics',...args])};es.Config={bool:key=>key==='autocomplete_enabled'?!!options.autocomplete:key==='stuck_prompt_enabled'?!!options.stuck:false,num:()=>1000,list:()=>[]};
  const load=name=>vm.runInContext(readFileSync(new URL('../site/ember-solitaire/js/'+name+'.js',import.meta.url),'utf8'),h.context,{filename:name+'.js'});
  h.S.load();load('ui');
  let boardSource=readFileSync(new URL('../site/ember-solitaire/js/board.js',import.meta.url),'utf8');
  boardSource=boardSource.replace('  ES.Board = {','  root.__boardTest = { B, pendingMap, owned, holds, invalidators, endgameChecks };\n  ES.Board = {');
  vm.runInContext(boardSource,h.context,{filename:'board.js'});
  es.Board.mount();es.UI.go('game');
  function start(g=h.E.newGame(1,{seed:42}),opts={}){h.S.startGame(g);es.UI.go('game');es.Board.start(g,opts);return g;}
  return {...h,clock,document,nodes,get,animations,events,workers,load,start,B:es.Board,UI:es.UI,debug:h.context.__boardTest,
    visibility(hidden){document.hidden=hidden;emit(docEvents,'visibilitychange');},page(name){emit(windowEvents,name);},keydown(e){get('#board').dispatch('keydown',{preventDefault(){},...e});},Element};
}

export function finalHand(E,split=1){
  const g=E.newGame(1,{seed:42}),cards=E.newDeck(1,()=>0).filter(c=>parseInt(c.id.slice(1),36)<13).sort((a,b)=>b.rank-a.rank);cards.forEach(c=>{c.up=true;});
  g.cols=[cards.slice(0,13-split),...cards.slice(13-split).map(c=>[c])];while(g.cols.length<10)g.cols.push([]);g.stock=[];g.completed=g.bestCompleted=7;g.run=0;return g;
}
