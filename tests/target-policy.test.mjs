import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { targetPolicy, targetError } = createRequire(import.meta.url)('../miniprogram/utils/target-policy.js');
test('annual eligibility is exact, does not accumulate and stops after 3 changes', () => {
  const at = Date.parse('2027-09-07T08:00:00Z');
  const base = { target_change_count: 0, target_locked_until: new Date(at).toISOString() };
  assert.equal(targetPolicy(base, at - 1).canChange, false);
  assert.equal(targetPolicy(base, at).canChange, true);
  assert.equal(targetPolicy(base, at).remaining, 3);
  assert.equal(targetPolicy({...base, target_change_count: 2}, at).remaining, 1);
  assert.equal(targetPolicy({...base, target_change_count: 3}, at + 10 * 365 * 86400000).canChange, false);
  assert.equal(targetPolicy(base, Date.parse('2040-01-01')).remaining, 3);
});
test('missing or invalid policy fails closed and backend errors are readable', () => {
  for (const p of [null, {}, {target_change_count:-1}, {target_change_count:4}, {target_change_count:0, target_locked_until:'invalid'}]) assert.equal(targetPolicy(p).canChange, false);
  assert.match(targetError('TARGET_CHANGE_LIMIT'), /3 次/);
  assert.match(targetError('TARGET_CHANGE_LOCKED'), /一年/);
});

test('mini settings confirms, sends target only, then locks the returned profile', async () => {
  const require = createRequire(import.meta.url);
  let page, changes, calls = 0, confirm = false;
  const base = { id:'qa-only', birth_date:'1980-02-29', target_age:80, target_date:'2060-02-29', locale:'zh', target_change_count:0, target_locked_until:'2020-01-01T00:00:00Z' };
  const sandbox = { Date, Promise, wx: {showModal: o=>o.success({confirm}), showToast() {}}, require(path) {
    if (path.endsWith('localized-page')) return definition=>{page=definition;};
    if (path.endsWith('supabase')) return {updateProfile:async(id,value)=>{assert.equal(id,'qa-only');changes=value;calls++;return {...base,...value,target_change_count:1,target_locked_until:'2099-01-01T00:00:00Z'};}};
    return require('../miniprogram/utils/'+path.split('/').pop()+'.js');
  }};
  vm.runInNewContext(readFileSync(new URL('../miniprogram/pages/settings/settings.js',import.meta.url),'utf8'),sandbox);
  page.setData=function(data){Object.assign(this.data,data);};
  page.session={user:{id:'qa-only'}};
  page.setData({profile:base,locale:'zh'});page.refreshTargetPolicy();
  assert.equal(page.data.policy.canChange,true);
  await page.adjustTarget();assert.equal(calls,0); // no-op
  page.onTargetAgeInput({detail:{value:'081'}});assert.equal(page.data.targetAgeInput,'81');
  await page.adjustTarget();assert.equal(calls,0); // cancelled
  confirm=true;await page.adjustTarget();
  assert.deepEqual(JSON.parse(JSON.stringify(changes)),{target_age:81,target_date:'2061-02-28'});
  assert.equal(page.data.policy.remaining,2);assert.equal(page.data.policy.canChange,false);
  await page.adjustTarget();assert.equal(calls,1);
  page.setData({profile:{...base,target_change_count:3}});page.refreshTargetPolicy();
  assert.equal(page.data.policy.canChange,false);
});

test('mini API allows target changes but strips caller-supplied quota and birth date', async()=>{
  const require = createRequire(import.meta.url), requests=[];
  const app={globalData:{}};
  const sandbox={module:{exports:{}},require(path){return path==='../config'?{apiBase:'https://qa.invalid'}:path==='./runtime-config'?{loadRuntimeConfig:async()=>({supabaseUrl:'https://qa.invalid',publishableKey:'test-only'})}:require('../miniprogram/utils/life.js');},getApp:()=>app,wx:{
    getStorageSync:()=>({access_token:'test-only',user:{id:'qa-only'}}),
    request(o){requests.push(o);o.success({statusCode:200,data:o.url.endsWith('/config')?{supabaseUrl:'https://qa.invalid',publishableKey:'test-only'}:[{id:'qa-only',...o.data,target_change_count:1}]});}
  }};
  vm.runInNewContext(readFileSync(new URL('../miniprogram/utils/supabase.js',import.meta.url),'utf8'),sandbox);
  await sandbox.module.exports.updateProfile('qa-only',{target_age:81,target_date:'2061-02-28',target_change_count:0,target_locked_until:'2000-01-01',birth_date:'2000-01-01'});
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].data)),{target_age:81,target_date:'2061-02-28'});
  assert.equal(app.globalData.profile.target_change_count,1);
});
