import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=name=>readFileSync(new URL('../miniprogram/'+name,import.meta.url),'utf8');
test('20 photos use one batch signing request; all media survive including videos and GIFs',async()=>{
  const mod={exports:{}},calls=[];
  const media=Array.from({length:20},(_,i)=>({id:String(i),storage_path:`owner/entry/${i}.jpg`,media_type:'image/jpeg',created_at:'2026-09-15'}));
  media.push({id:'v',storage_path:'owner/entry/v.mp4',media_type:'video/mp4',created_at:'2026-09-15'},{id:'g',storage_path:'owner/entry/g.gif',media_type:'image/gif',created_at:'2026-09-15'});
  vm.runInNewContext(read('utils/supabase.js'),{module:mod,require:p=>p.endsWith('runtime-config')?{loadRuntimeConfig:async()=>({supabaseUrl:'https://test.invalid',publishableKey:'public'})}:p.endsWith('media-policy')?require('../miniprogram/utils/media-policy.js'):{},wx:{getStorageSync:()=>({user:{id:'owner'},access_token:'test'}),request(o){calls.push(o);o.success({statusCode:200,data:o.data?.paths?o.data.paths.map(path=>({path,signedURL:'/object/sign/entry-media/'+path+'?token=test'})):[{id:'entry',entry_media:media}]});}}});
  const [entry]=await mod.exports.getEntries('owner',20);
  assert.equal(calls.length,2);assert.equal(calls[1].data.paths.length,20);assert.equal(entry.entry_media.length,22);
  assert.equal(entry.entry_media.filter(m=>m.signed_url).length,20);
  assert.ok(calls[1].data.paths.every(path=>path.endsWith('.jpg')));
  const [again]=await mod.exports.getEntries('owner',20);
  assert.equal(calls.length,3);assert.equal(again.entry_media[0].signed_url,entry.entry_media[0].signed_url);
  await mod.exports.getEntries('another-owner',20);
  assert.equal(calls.length,5); // URL cache cannot cross account boundaries.
});

test('fresh public config cache resolves before network; background failure does not block browsing',async()=>{
  const mod={exports:{}},calls=[];let stored;
  const value={supabaseUrl:'https://test.invalid',publishableKey:'public',locale:'zh',session:'must not keep'};
  vm.runInNewContext(read('utils/runtime-config.js'),{module:mod,require:()=>({apiBase:'https://app.invalid',supabaseUrl:'https://test.invalid'}),wx:{getStorageSync:()=>({apiBase:'https://app.invalid',savedAt:Date.now(),value}),setStorageSync:(_k,v)=>{stored=v;},request:o=>calls.push(o)}});
  const config=await mod.exports.loadRuntimeConfig();assert.equal(config.publishableKey,'public');assert.equal(config.session,undefined);assert.equal(calls.length,1);
  calls[0].fail();await Promise.resolve();assert.equal((await mod.exports.loadRuntimeConfig()).publishableKey,'public');assert.equal(stored,undefined);
});

test('expired or wrong-host cached config cannot redirect requests; only public fields persist',async()=>{
  for(const wrongHost of [false,true]){
    const mod={exports:{}},calls=[];let stored;
    vm.runInNewContext(read('utils/runtime-config.js'),{module:mod,require:()=>({apiBase:'https://app.invalid',supabaseUrl:'https://test.invalid'}),wx:{getStorageSync:()=>({apiBase:'https://app.invalid',savedAt:wrongHost?Date.now():1,value:{supabaseUrl:wrongHost?'https://evil.invalid':'https://test.invalid',publishableKey:'old'}}),setStorageSync:(_k,v)=>{stored=v;},request:o=>calls.push(o)}});
    const pending=mod.exports.loadRuntimeConfig();assert.equal(calls.length,1);
    calls[0].success({statusCode:200,data:{supabaseUrl:'https://test.invalid',publishableKey:'public',locale:'en',privateValue:'discard'}});
    await pending;assert.equal(stored.value.privateValue,undefined);assert.equal(stored.value.publishableKey,'public');
  }
});
