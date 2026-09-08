import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const root=new URL('../miniprogram/',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('all pages offer friend-only app sharing and preserve normal lifecycle',async()=>{
 const calls={show:0,enabled:[],hidden:[]};
 const sandbox={module:{exports:{}},require:()=>require('../miniprogram/utils/locale-copy.js'),getApp:()=>({globalData:{locale:'en',profile:{email:'PRIVATE@example.invalid'}}}),wx:{showShareMenu:o=>calls.enabled.push(o.menus),hideShareMenu:o=>calls.hidden.push(o.menus)}};
 vm.runInNewContext(read('utils/app-share.js'),sandbox);
 const wrapped=sandbox.module.exports({onShow:async()=>{calls.show++;return 'ok';},onShareTimeline(){return {query:'private-entry'};}});
 assert.equal(await wrapped.onShow(),'ok');assert.equal(calls.show,1);
 assert.deepEqual(Array.from(calls.enabled[0]),['shareAppMessage']);
 assert.deepEqual(Array.from(calls.hidden[0]),['shareTimeline']);
 assert.equal(wrapped.onShareTimeline,undefined);
 const share=wrapped.onShareAppMessage({target:{dataset:{email:'PRIVATE',id:'private-entry'}}});
 assert.equal(share.path,'/pages/index/index');assert.equal(share.imageUrl,'/images/lifescale-icon.png');
 assert.match(share.title,/LifeScale/);assert.doesNotMatch(JSON.stringify(share),/PRIVATE|private-entry|query/);
});
test('every route uses the shared friend-only menu without hiding it again',()=>{
 for(const path of JSON.parse(read('app.json')).pages){
  const js=read(path+'.js');
  assert.match(js,/require\("\.\.\/\.\.\/utils\/localized-page"\)/);
  assert.doesNotMatch(js,/hideShareMenu|onShareTimeline|onShareAppMessage/);
 }
 assert.match(read('utils/localized-page.js'),/Page\(withAppShare\(definition\)\)/);
});
