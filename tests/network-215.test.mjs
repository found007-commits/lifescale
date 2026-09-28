import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resilientFetch} from '../lib/network-fetch.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const raw = 'request:fail errcode:-101 cronet_error_code:-101 error_msg:net::ERR_CONNECTION_RESET';
function mini(failures = Infinity) {
  let calls = 0; const mod = {exports:{}};
  const session = {user:{id:'test-only'},access_token:'synthetic'};
  vm.runInNewContext(read('miniprogram/utils/supabase.js'), {
    module:mod, setTimeout:fn=>fn(), getApp:()=>({globalData:{}}),
    require:p=>p.endsWith('runtime-config')?{loadRuntimeConfig:async()=>({supabaseUrl:'https://test.invalid',publishableKey:'test'})}:{},
    wx:{getStorageSync:()=>session,request(o){ calls++; if(calls<=failures)o.fail({errMsg:raw}); else o.success({statusCode:200,data:[{id:'test-only'}]}); }},
  });
  return {api:mod.exports,calls:()=>calls};
}
test('mini recovers a reset read once and caps persistent failures with a human-readable error', async()=>{
  const recover=mini(1); assert.equal((await recover.api.getProfile('test-only')).id,'test-only'); assert.equal(recover.calls(),2);
  const fail=mini(); await assert.rejects(fail.api.getProfile('test-only'),/网络连接暂时中断/); assert.equal(fail.calls(),2);
});
test('mini never automatically replays a failed write',async()=>{
  const fail=mini(); await assert.rejects(fail.api.updateProfile('test-only',{display_name:'test'})); assert.equal(fail.calls(),1);
});
test('dashboard keeps existing data on failure and manual retry loads again',async()=>{
  let page, calls=0;
  const profile={id:'test-only'},session={user:{id:'test-only'}};
  vm.runInNewContext(read('miniprogram/pages/dashboard/dashboard.js'),{
    require:p=>p.endsWith('localized-page')?d=>page=d:p.endsWith('supabase')?{requireSession:()=>session,getProfile:async()=>{calls++;throw Error('网络连接暂时中断');}}:p.endsWith('data-freshness')?{stamp:()=>({}),reusable:()=>false}:{},
    wx:{stopPullDownRefresh(){}},getApp:()=>({globalData:{}}),
  });
  page.setData=function(v){Object.assign(this.data,v)};
  Object.assign(page.data,{profile,metrics:{remainingDays:123},recentEntries:[{id:'existing'}]});
  await page.load(); await page.retryLoad();
  assert.equal(calls,2); assert.equal(page.data.recentEntries[0].id,'existing'); assert.equal(page.data.metrics.remainingDays,123);
  assert.match(read('miniprogram/pages/dashboard/dashboard.wxml'),/bindtap="retryLoad"/);
});
test('browser retries a transport-failed read, not writes, HTTP errors or aborted requests',async()=>{
  const original=globalThis.fetch; let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;if(calls===1)throw new TypeError('Failed to fetch');return new Response('ok');};
    assert.equal((await resilientFetch('https://test.invalid')).status,200);assert.equal(calls,2);
    for(const method of ['POST','PATCH','DELETE']) {
      calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};
      await assert.rejects(resilientFetch('https://test.invalid',{method}),/网络连接/);assert.equal(calls,1);
    }
    calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
    assert.equal((await resilientFetch('https://test.invalid')).status,403);assert.equal(calls,1);
    calls=0;globalThis.fetch=async()=>{calls++;throw new DOMException('Aborted','AbortError');};
    await assert.rejects(resilientFetch('https://test.invalid'),{name:'AbortError'});assert.equal(calls,1);
    calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};
    await assert.rejects(resilientFetch('https://test.invalid'),/网络连接/);assert.equal(calls,2);
  } finally {globalThis.fetch=original;}
});
// 2.0.15 carries two changes: the network recovery this file tests, and the dashboard
// bootstrap that shares the version. Every other protected file must be untouched. The
// authoritative record of "what this release changed" is tests/fixtures/ui-2015-baseline.json.
test('2.0.15 changes no protected file outside the ones this release intends',()=>{
  const baseline=JSON.parse(read('tests/fixtures/ui-2014-baseline.json'));
  const allowed=new Set([
    'miniprogram/utils/supabase.js','miniprogram/pages/dashboard/dashboard.js','lib/supabase/client.ts','app/components/Dashboard.tsx',
    'miniprogram/app.js',
  ]);
  for(const [path,hash] of Object.entries(baseline.protectedFiles)){
    if(allowed.has(path))continue;
    assert.equal(createHash('sha256').update(read(path)).digest('hex'),hash,path);
  }
});
