import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const game='ember-solitaire/';
// Approved generated format: the verifier regenerates and compares every byte.
export function generate(source) {
  const inputs=[...source].filter(([p])=>p.startsWith(game)).sort(([a],[b])=>a<b?-1:1);
  const hash=createHash('sha256').update(readFileSync(new URL(import.meta.url),'utf8').replace(/\r\n/g,'\n'));
  for(const [p,b] of inputs) hash.update(p+'\0'+b.length+'\0').update(b);
  const id=hash.digest('hex'), base=`/ember-solitaire/_releases/${id}/`;
  const release=new Map(inputs.filter(([p])=>p!==game+'sw.js').map(([p,b])=>[p.slice(game.length),b]));
  for(const p of ['index.html','privacy.html']) {
    let text=release.get(p).toString().replace('<head>','<head>\n<base href="'+base+'">\n<meta name="ember-release" content="'+id+'">\n<meta name="ember-scope" content="/ember-solitaire/">');
    text=text.replace(/<(script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g,(tag,kind,path)=>{
      if(!release.has(path)||!(kind==='script'||/rel="stylesheet"/.test(tag)))return tag;
      const integrity=createHash('sha256').update(release.get(path)).digest('base64');
      return tag.replace(/>$/,' integrity="sha256-'+integrity+'" crossorigin="anonymous">');
    });
    release.set(p,Buffer.from(text));
  }
  const manifest=JSON.parse(release.get('manifest.webmanifest'));
  manifest.start_url='/ember-solitaire/index.html';manifest.scope='/ember-solitaire/';
  for(const icon of manifest.icons)icon.src=base+icon.src;
  release.set('manifest.webmanifest',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  // One-suit core; other suits, backs, themes and high-resolution art are optional.
  const core=p=>/^(?:js\/|css\/|assets\/fonts\/)/.test(p)||['index.html','privacy.html','style.css','manifest.webmanifest','ember_spade.png'].includes(p)||
    /^assets\/cards\/spades\/(?!.*@2x)/.test(p)||p==='assets/cards/backs/spade.webp'||
    // Mode-picker fans and the default-back preview are visible before play.
    /^assets\/cards\/(?:spades\/(?:ace|queen|king)|(?:hearts|diamonds|clubs)\/king)@2x\.webp$/.test(p)||p==='assets/cards/backs/spade@2x.webp'||
    /^assets\/branding\//.test(p)||p==='assets/effects/smoke.webp'||p==='assets/ui/borders/metal_tile.webp'||
    /^assets\/environments\/(?:splash_|forge_hall_|forge_chamber_|hall_legends_|anvil\.|pedestal\.|table_iron\.)/.test(p);
  const data={format:1,id,base,files:[...release].sort(([a],[b])=>a<b?-1:1).map(([path,b])=>({path,sha256:digest(b),bytes:b.length,core:core(path)}))};
  const output=new Map(source);
  for(const [p,b]of release) output.set(game+'_releases/'+id+'/'+p,b);
  for(const p of ['index.html','privacy.html','manifest.webmanifest'])output.set(game+p,release.get(p));
  output.set(game+'release.json',Buffer.from(JSON.stringify(data,null,2)+'\n'));
  output.set(game+'_releases/'+id+'/release.json',output.get(game+'release.json'));
  const template=source.get(game+'sw.js').toString();
  if(!template.includes('const RELEASE = null; // BUILD_RELEASE'))throw Error('Missing worker release marker');
  output.set(game+'sw.js',Buffer.from(template.replace('const RELEASE = null; // BUILD_RELEASE','const RELEASE = '+JSON.stringify(data)+';')));
  return {output,release:data};
}
