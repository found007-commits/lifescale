import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../miniprogram/'+name,import.meta.url),'utf8');
const HOUR=60*60*1000;
const KEY='lifescale:public-config:v1';

// A runtime-config module whose stored cache and network are scripted by the test. The
// configured project is db.invalid, which the stored payload is checked against.
function runtime(savedAt,value={supabaseUrl:'https://db.invalid',publishableKey:'public'}){
  const mod={exports:{}}, requests=[], stored=[];
  vm.runInNewContext(read('utils/runtime-config.js'),{
    module:mod,
    require:()=>({apiBase:'https://app.invalid',supabaseUrl:'https://db.invalid'}),
    wx:{getStorageSync:()=>({apiBase:'https://app.invalid',savedAt,value}),
      setStorageSync:(key,payload)=>stored.push({key,payload}),
      request:o=>requests.push(o)},
  });
  return {load:mod.exports.loadRuntimeConfig, requests, stored};
}

test('a cache inside the window is served without waiting and still refreshed in the background',async()=>{
  const r=runtime(Date.now()-23*HOUR);
  const value=await r.load();
  assert.equal(value.publishableKey,'public','a 23 hour old cache must still be usable');
  assert.equal(r.requests.length,1,'a background refresh must be started on every cache hit');
  assert.equal(r.requests[0].url,'https://app.invalid/api/miniprogram/service-config');
});

test('a cache past the window is not served, so a rotated key cannot be pinned',async()=>{
  const r=runtime(Date.now()-25*HOUR);
  const loading=r.load();
  await Promise.resolve();
  assert.equal(r.requests.length,1,'an expired cache must go to the network');
  r.requests[0].success({statusCode:200,data:{supabaseUrl:'https://db.invalid',publishableKey:'rotated'}});
  const value=await loading;
  assert.equal(value.publishableKey,'rotated','the network copy must win once the window is over');
  assert.ok(r.stored.some(entry=>entry.key===KEY),'the refreshed copy must be written back');
});

test('a cache pointing at another project is ignored',async()=>{
  const r=runtime(Date.now()-1*HOUR,{supabaseUrl:'https://other.invalid',publishableKey:'attacker'});
  const loading=r.load();
  await Promise.resolve();
  assert.equal(r.requests.length,1,'a mismatched supabaseUrl must not be trusted');
  r.requests[0].success({statusCode:200,data:{supabaseUrl:'https://db.invalid',publishableKey:'real'}});
  assert.equal((await loading).supabaseUrl,'https://db.invalid');
});

test('a cache stamped in the future is ignored',async()=>{
  const r=runtime(Date.now()+HOUR);
  const loading=r.load();
  await Promise.resolve();
  assert.equal(r.requests.length,1,'a future savedAt means the clock moved, so refetch');
  r.requests[0].success({statusCode:200,data:{supabaseUrl:'https://db.invalid',publishableKey:'real'}});
  assert.equal((await loading).publishableKey,'real');
});

test('the cache holds only public connection settings',async()=>{
  const r=runtime(Date.now()-23*HOUR,{supabaseUrl:'https://db.invalid',publishableKey:'public',session:{access_token:'leak'}});
  const value=await r.load();
  assert.equal(value.session,undefined,'a session must never be read back out of the config cache');
});
