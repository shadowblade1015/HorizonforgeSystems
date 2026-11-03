import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromeAudit,until} from './chrome-audit.mjs';
const out=resolve('.phase2-backup/suit-hint');mkdirSync(out,{recursive:true});
const oldCSS=execFileSync('git',['show','b895c61:site/ember-solitaire/css/board.css'],{encoding:'utf8',windowsHide:true});
const server=createServer((req,res)=>{try{const path=resolve('site','.'+new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path.endsWith('ember-solitaire')?path+'/index.html':path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let chrome;const checks=[];
const check=(name,ok)=>{checks.push({name,pass:!!ok});if(!ok)throw Error(name)};
try {chrome=await chromeAudit();const tab=await chrome.tab();await tab.navigate('http://127.0.0.1:'+server.address().port+'/ember-solitaire/index.html?nosw&screen=home');await until(()=>tab.evaluate('ES?.UI?.current==="home"&&ES.Store.canEdit'),'boot');
await tab.evaluate('ES.Store.state.ftue.intro=true;ES.Store.state.settings.reduced=true;ES.UI.applySettings();ES.Screens.newGame(4);');
// Reuse exactly the same deterministic opening in both images.
await tab.evaluate('ES.Store.startGame(ES.Engine.newGame(4,{seed:917}));ES.Board.start(ES.Store.state.game,{animateDeal:false});');
for(const width of [1280,390]) {await tab.call('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:900,deviceScaleFactor:1,mobile:width===390});
await tab.evaluate(`(()=>{const s=document.createElement('style');s.id='baseline-hint-style';s.textContent=${JSON.stringify(oldCSS)};document.querySelector('link[href*="board.css"]').disabled=true;document.head.appendChild(s);ES.Board.start(ES.Store.state.game,{animateDeal:false});ES.Board.doHint()})()`);
await new Promise(r=>setTimeout(r,550));writeFileSync(resolve(out,`before-${width}.png`),Buffer.from((await tab.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
await tab.evaluate('document.querySelector("#baseline-hint-style").remove();[...document.querySelectorAll("link")].find(x=>x.href.endsWith("board.css")).disabled=false;ES.Board.start(ES.Store.state.game,{animateDeal:false});ES.Board.doHint()');
check('source and destination '+width,await tab.evaluate('document.querySelectorAll(".card.hint-src").length>0&&!!document.querySelector(".col-hl.hint-dst")'));
check('static outline '+width,await tab.evaluate('getComputedStyle(document.querySelector(".hint-src")).outlineStyle==="solid"&&getComputedStyle(document.querySelector(".hint-src")).animationName==="none"'));
writeFileSync(resolve(out,`after-${width}.png`),Buffer.from((await tab.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
const timing = await tab.evaluate(`(async()=>{ES.Board.clearHints();ES.Board.doHint();await new Promise(r=>setTimeout(r,2300));const visible=!!document.querySelector('.card.hint-src');await new Promise(r=>setTimeout(r,450));return {visible,cleared:!document.querySelector('.card.hint-src')};})()`);check('hint visible after 2200ms '+width,timing.visible);check('hint cleared after 2600ms '+width,timing.cleared);}
writeFileSync(resolve(out,'summary.json'),JSON.stringify({checks},null,2));console.log(JSON.stringify(checks));
}finally{await chrome?.close();server.close();server.closeAllConnections();}
