// Shared development-only CDP transport. Fresh profile; never opens a user profile.
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
export async function chromeAudit() {
 const profile=await mkdtemp(resolve(tmpdir(),'ember-release-'));
 const child=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','--disable-extensions','--disable-background-networking','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let socket;
 try {
  const endpoint=await new Promise((res,rej)=>{let output='';const timer=setTimeout(()=>rej(Error('Chrome startup timeout')),20000);child.on('error',rej);child.stderr.on('data',d=>{output+=d;const m=output.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);res(m[1]);}});});
  socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let serial=0;const pending=new Map(),events=[];
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id){events.push(m);return;}const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},25000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params,sessionId}));});
  const tab=async(browserContextId)=>{
   const {targetId}=await send('Target.createTarget',{url:'about:blank',...(browserContextId?{browserContextId}:{})});
   const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(method,params={})=>send(method,params,sessionId);
   await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
   const evaluate=async(expression)=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
   return {targetId,call,evaluate,async navigate(url){await call('Page.navigate',{url});},async close(){await send('Target.closeTarget',{targetId});}};
  };
  return {send,tab,events,profile,async close(){try{await send('Browser.close');}catch{}socket.close();child.kill();}};
 } catch(error) {socket?.close();child.kill();throw error;}
}
export async function until(fn,label,timeout=25000) {
 const end=Date.now()+timeout;let last;
 while(Date.now()<end){try{const result=await fn();if(result)return result;}catch(e){last=e.message;}await new Promise(r=>setTimeout(r,100));}
 throw Error('Timed out: '+label+(last?' ('+last+')':''));
}
