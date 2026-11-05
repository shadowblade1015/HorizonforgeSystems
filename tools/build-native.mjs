// Standalone bundled game: no hosted release paths, registration or remote assets.
import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {readTree,root} from './verify-source.mjs';
const output=resolve(root,'www');
if(existsSync(output))renameSync(output,resolve(root,'.native-backup-'+Date.now()));
const files=readTree(resolve(root,'site/ember-solitaire'));
for(const [path,bytes] of files){
 if(path==='sw.js'||path==='js/offline.js')continue;
 let body=bytes;
 if(path==='index.html')body=Buffer.from(bytes.toString().replace('<script src="js/offline.js"></script>',''));
 if(path==='js/build-config.js')body=Buffer.from('window.ES_BUILD = '+JSON.stringify({version:'2.1.0',versionCode:21,native:true,firebase:false,adsProduction:false,adsEnabled:false,privacyUrl:'./privacy.html',supportEmail:'support@horizonforgesystems.com'})+';\n');
 const dest=resolve(output,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,body);
}
const html=readFileSync(resolve(output,'index.html'),'utf8');
if(html.includes('/ember-solitaire/_releases/')||html.includes('src="js/offline.js"'))throw Error('Web release leaked into native package');
console.log('Native game bundled in www; no Service Worker or hosted gameplay dependencies.');
