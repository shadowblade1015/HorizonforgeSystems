import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {readTree,root,hash} from '../tools/verify-source.mjs';
test('native build is byte reproducible and bundles local routes, font, worker and all mode artwork',()=>{
 const build=()=>{execFileSync(process.execPath,['tools/build-native.mjs'],{cwd:root,windowsHide:true});return readTree(resolve(root,'www'))};const a=build(),b=build();assert.deepEqual([...a].map(([p,v])=>[p,hash(v)]),[...b].map(([p,v])=>[p,hash(v)]));
 assert.equal(a.has('sw.js'),false);assert.equal(a.has('js/offline.js'),false);const html=a.get('index.html').toString();assert.doesNotMatch(html,/_releases|js\/offline.js/);
 for(const path of ['privacy.html','js/engine.js','js/stuck-worker.js','js/platform.js','js/store.js'])assert.ok(a.has(path),path);
 for(const suit of ['spades','hearts','clubs','diamonds'])assert.equal([...a.keys()].filter(p=>p.startsWith('assets/cards/'+suit+'/')&&!p.includes('@2x')).length,13);
 const config=a.get('js/build-config.js').toString();assert.match(config,/'?native"?:true/);assert.match(config,/'?adsEnabled"?:false/);
 for(const [p,v] of a)if(/\.(html|css|js)$/.test(p))assert.doesNotMatch(v.toString(),/https?:\/\/[^'"\s]+\.(?:js|woff2)/,'remote gameplay dependency '+p);
});
test('native metadata identifies the shared application and keeps production SDK configuration absent',()=>{
 const config=JSON.parse(readFileSync(resolve(root,'capacitor.config.json')));assert.equal(config.webDir,'www');assert.equal(config.appId,'com.horizonforgesystems.embersolitaire');assert.equal(config.server,undefined);
 const gradle=readFileSync(resolve(root,'android/variables.gradle'),'utf8');assert.match(gradle,/targetSdkVersion = 36/);
 const project=readFileSync(resolve(root,'ios/App/App.xcodeproj/project.pbxproj'),'utf8');assert.match(project,/PrivacyInfo.xcprivacy in Resources/);assert.match(project,/MARKETING_VERSION = 2.1.0/);
});
