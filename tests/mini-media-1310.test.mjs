import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../miniprogram/'+path,import.meta.url),'utf8');
const base='https://synthetic.supabase.invalid';
const attachment=(id)=>({id,storage_path:`owner/entry/${id}.jpg`,created_at:'2026-09-09'});
function apiFixture() {
  const requests=[];let rejectSign=false,variant='relative',signs=0;
  const entry={id:'entry',content:'Synthetic private words',entry_date:'2026-09-09',mood:'calm',category:'daily',entry_media:[attachment('a'),attachment('b')]};
  const moduleStub={exports:{}};
  vm.runInNewContext(read('utils/supabase.js'),{module:moduleStub,getApp:()=>({globalData:{}}),require:path=>path.endsWith('runtime-config')?{loadRuntimeConfig:async()=>({supabaseUrl:base,publishableKey:'synthetic'})}:path.endsWith('media-policy')?require('../miniprogram/utils/media-policy.js'):path.endsWith('/life')?require('../miniprogram/utils/life.js'):{apiBase:'https://test.invalid'},wx:{
    getStorageSync:()=>({access_token:'synthetic',user:{id:'owner'}}),
    request(o){requests.push(o);if(o.url.includes('/object/sign/')){
      signs++;if(rejectSign)return o.success({statusCode:503,data:{message:'sign unavailable'}});
      const sign = name => {
        const path='/object/sign/entry-media/'+name+'?token=synthetic-'+signs;
        return variant==='absolute'?base+'/storage/v1'+path:variant==='storage'?'/storage/v1'+path:variant==='invalid'?'https://wrong.invalid/photo':path;
      };
      return o.success({statusCode:200,data:o.data?.paths ? o.data.paths.map(path=>({path,signedURL:sign(path)})) : {signedURL:sign(o.url.split('/entry-media/')[1])}});
    }o.success({statusCode:200,data:[entry]});},
  }});
  return{api:moduleStub.exports,requests,entry,setReject:value=>{rejectSign=value;},setVariant:value=>{variant=value;}};
}
function shareFixture(api,entry,{downloadFail=false,decodeFail=false,layout='separate'}={}) {
  let page;const downloads=[],removed=[],exports=[],sent=[],timers=new Map();let timerId=0;
  const ctx={measureText:text=>({width:Array.from(text).length*17}),fillRect(){},drawImage(){},fillText(){}};
  const canvas={getContext:()=>ctx,createImage(){const image={width:400,height:300};Object.defineProperty(image,'src',{set(){if(decodeFail)image.onerror();else image.onload();}});return image;}};
  const wx={getFileSystemManager:()=>({unlink:o=>removed.push(o.filePath)}),
    getImageInfo:o=>{downloads.push(o.src);if(downloadFail)o.fail({errMsg:'private URL must not be echoed'});else o.success({path:'wxfile://local-download',width:400,height:300});},
    canvasToTempFilePath:o=>{const path='wxfile://generated-'+exports.length+'.png';exports.push(path);o.success({tempFilePath:path});},
    showShareImageMenu:o=>{sent.push(o);o.success({});},showToast(){},
  };
  vm.runInNewContext(read('pages/share/share.js'),{getApp:()=>({globalData:{}}),wx,
    setTimeout:(fn)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    require:path=>path.endsWith('localized-page')?definition=>{page=definition;}:path.endsWith('supabase')?api:require('../miniprogram/utils/'+path.split('/').pop()+'.js'),
  });
  page.setData=values=>Object.assign(page.data,values);page.getOpenerEventChannel=()=>({on:(_,callback)=>callback({entry,locale:'en'})});
  page.onLoad();page.canvas=canvas;page.setData({busy:false,locale:'en',layout});
  return{page,downloads,removed,exports,sent,wx,timers};
}
test('real API adapter resolves runtime config and all supported signed URL forms',async()=>{
  const f=apiFixture();
  for(const variant of ['relative','storage','absolute']){
    f.setVariant(variant);const [entry]=await f.api.getEntries('owner');
    assert.equal(entry.entry_media.length,2);
    for(const media of entry.entry_media)assert.match(media.signed_url,/^https:\/\/synthetic.supabase.invalid\/storage\/v1\/object\/sign\/entry-media\//);
  }
  f.setVariant('invalid');await assert.rejects(f.api.signEntryMedia(attachment('a')));
});
test('list sign failures preserve attachments; actual share retry re-signs and generates every selected photo',async()=>{
  const f=apiFixture();f.setReject(true);const [entry]=await f.api.getEntries('owner');
  assert.equal(entry.entry_media.length,2);assert.ok(entry.entry_media.every(media=>media.signed_url===''));
  const s=shareFixture(f.api,entry);await s.page.generate();
  assert.equal(s.page.data.cards.length,0);assert.equal(s.page.data.busy,false);
  await s.page.shareImage();assert.equal(s.sent.length,0);
  f.setReject(false);await s.page.generate();assert.equal(s.downloads.length,2);assert.equal(s.page.photos.length,2);assert.equal(s.page.data.cards.length,1);
  assert.equal(entry.entry_media[0].signed_url,'');assert.equal(s.timers.size,0);
});
test('expired links refresh without restoring excluded photos, text or hidden metadata in either layout',async()=>{
  for(const layout of ['separate','overlay']){
    const f=apiFixture();const [entry]=await f.api.getEntries('owner');const old=entry.entry_media[1].signed_url;
    const s=shareFixture(f.api,entry,{layout});s.page.editSelection();s.page.onShareText({detail:{value:'Chosen words only'}});
    s.page.togglePhoto({currentTarget:{dataset:{index:0}}});s.page.setData({showDate:false,showMood:false});await s.page.applySelection();
    assert.equal(s.downloads.length,1);assert.notEqual(s.downloads[0],old);assert.match(s.downloads[0],/b.jpg/);
    assert.equal(s.page.selection.entry.content,'Chosen words only');assert.equal(s.page.selection.entry.entry_date,'');assert.equal(s.page.selection.entry.moodLabel,'');
    assert.equal(s.page.appliedPhotos[0].selected,false);assert.equal(entry.content,'Synthetic private words');assert.equal(s.page.photos.length,1);
  }
});
test('download failures discard stale output, report safe error, and retry with newly signed URLs',async()=>{
  const f=apiFixture();const s=shareFixture(f.api,f.entry,{downloadFail:true});
  s.page.setData({cards:[{path:'wxfile://old.png'}]});s.page.files.add('wxfile://old.png');await s.page.generate();
  assert.equal(s.page.data.cards.length,0);assert.ok(s.removed.includes('wxfile://old.png'));assert.match(s.page.data.error,/connection/);assert.doesNotMatch(s.page.data.error,/private URL/);
  const first=s.downloads[0];s.wx.getImageInfo=o=>{s.downloads.push(o.src);o.success({path:'wxfile://retry',width:400,height:300});};
  await s.page.generate();assert.notEqual(s.downloads[1],first);assert.equal(s.page.photos.length,2);
});
test('decode failure never drops a photo or produces a partial share',async()=>{
  const f=apiFixture();const s=shareFixture(f.api,f.entry,{decodeFail:true});await s.page.generate();
  assert.equal(s.page.data.cards.length,0);assert.equal(s.exports.length,0);assert.equal(s.page.data.busy,false);assert.match(s.page.data.error,/could not be opened/);assert.equal(s.timers.size,0);
});
test('text-only generation does not call storage signing or image downloads',async()=>{
  const s=shareFixture({signEntryMedia:()=>{throw Error('unexpected signing');}},{content:'Text only',entry_media:[]});
  await s.page.generate();assert.equal(s.downloads.length,0);assert.equal(s.page.data.cards.length,1);
});
test('download timeout unlocks retry; leaving during download cannot generate an image',async()=>{
  const f=apiFixture();const s=shareFixture(f.api,f.entry);let download;
  s.wx.getImageInfo=o=>{download=o;};const generation=s.page.generate();
  while(!download)await Promise.resolve();
  for(const callback of s.timers.values())callback();s.timers.clear();await generation;
  assert.equal(s.page.data.busy,false);assert.equal(s.exports.length,0);
  const next=shareFixture(f.api,f.entry);let pending;next.wx.getImageInfo=o=>{pending=o;};
  const abandoned=next.page.generate();while(!pending)await Promise.resolve();next.page.onUnload();
  pending.success({path:'wxfile://late',width:400,height:300});await abandoned;assert.equal(next.exports.length,0);
});
test('a late-page export failure cleans up partial output and exposes no shareable page',async()=>{
  const s=shareFixture({}, {content:'Long synthetic record. '.repeat(600),entry_media:[]});let count=0;
  s.wx.canvasToTempFilePath=o=>{if(count++===0)o.success({tempFilePath:'wxfile://partial.png'});else o.fail({errMsg:'export failure'});};
  await s.page.generate();assert.ok(count>1);assert.ok(s.removed.includes('wxfile://partial.png'));assert.equal(s.page.files.size,0);assert.equal(s.page.data.cards.length,0);
});
test('all mini JavaScript passes undefined-variable and basic control-flow checks',async()=>{
  const lint=new ESLint({overrideConfigFile:new URL('../eslint.mini.config.mjs',import.meta.url).pathname});
  const results=await lint.lintFiles(['miniprogram/**/*.js']);
  assert.ok(results.length>20);assert.equal(results.reduce((sum,result)=>sum+result.errorCount,0),0,JSON.stringify(results.filter(result=>result.errorCount).map(result=>({file:result.filePath,messages:result.messages}))));
});
test('all mini page template expressions parse without syntax errors',()=>{
  for(const page of readdirSync(new URL('../miniprogram/pages/',import.meta.url))) {
    for(const [,expression] of read(`pages/${page}/${page}.wxml`).matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      assert.doesNotThrow(()=>new vm.Script('('+expression+')'),`${page}: ${expression}`);
    }
  }
});
