import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const { targetPolicy, targetError, targetConfirmation } = createRequire(import.meta.url)('../miniprogram/utils/target-policy.js');
test('first year allows three changes; anniversary starts annual changes; seven total', () => {
  const at = Date.parse('2027-09-07T08:00:00Z');
  const base = { created_at:'2026-09-07T08:00:00Z', target_change_count: 0, target_locked_until: new Date(at).toISOString() };
  assert.equal(targetPolicy(base, at - 1).canChange, true);
  assert.equal(targetPolicy(base, at).canChange, true);
  assert.equal(targetPolicy(base, at).remaining, 7);
  assert.equal(targetPolicy({...base, target_change_count: 2}, at - 1).firstYearRemaining, 1);
  assert.equal(targetPolicy({...base, target_change_count: 3}, at - 1).canChange, false);
  assert.equal(targetPolicy({...base, target_change_count: 3}, at).canChange, true);
  assert.equal(targetPolicy({...base, target_change_count: 3}, at).firstYear, false);
  assert.equal(targetPolicy({...base, target_change_count: 7}, at + 10 * 365 * 86400000).canChange, false);
  assert.equal(targetPolicy(base, Date.parse('2040-01-01')).remaining, 7);
  const annual = {...base,target_change_count:4,target_locked_until:'2028-10-01T08:00:00Z'};
  assert.equal(targetPolicy(annual, Date.parse(annual.target_locked_until)-1).canChange,false);
  assert.equal(targetPolicy(annual, Date.parse(annual.target_locked_until)).canChange,true);
});
test('leap-day anniversary clamps in UTC and never resets existing counts', () => {
  const profile={created_at:'2024-02-29T10:00:00Z', target_locked_until:'2025-02-28T10:00:00Z',target_change_count:3};
  assert.equal(targetPolicy(profile,Date.parse(profile.target_locked_until)-1).canChange,false);
  assert.equal(targetPolicy(profile,Date.parse(profile.target_locked_until)).canChange,true);
  assert.equal(targetPolicy(profile,Date.parse(profile.target_locked_until)).remaining,4);
});
test('confirmation tells the truth about first-year and final opportunities in all locales', () => {
  const policy={remaining:7,firstYear:true,firstYearRemaining:3};
  assert.match(targetConfirmation(81,policy), /首年还可修改 2 次，无需等待/);
  assert.match(targetConfirmation(81,{...policy,remaining:5,firstYearRemaining:1},true), /setup anniversary/);
  assert.match(targetConfirmation(81,{remaining:1,firstYear:false},true), /All 7 changes will be used up/);
  assert.match(targetConfirmation(81,policy,false,true), /首年還可修改 2 次/);
});
test('missing or invalid policy fails closed and backend errors are readable', () => {
  for (const p of [null, {}, {target_change_count:-1}, {target_change_count:8}, {target_change_count:0, target_locked_until:'invalid'}, {target_change_count:0,target_locked_until:'2020-01-01',created_at:'invalid'}]) assert.equal(targetPolicy(p).canChange, false);
  assert.match(targetError('TARGET_CHANGE_LIMIT'), /7 次/);
  assert.match(targetError('TARGET_CHANGE_LOCKED'), /下次可调整/);
});

test('mini settings confirms, sends target only, then locks the returned profile', async () => {
  const require = createRequire(import.meta.url);
  let page, changes, calls = 0, confirm = false;
  const base = { id:'qa-only', created_at:'2019-01-01T00:00:00Z', birth_date:'1980-02-29', target_age:80, target_date:'2060-02-29', locale:'zh', target_change_count:0, target_locked_until:'2020-01-01T00:00:00Z' };
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
  assert.equal(page.data.policy.remaining,6);assert.equal(page.data.policy.canChange,false);
  await page.adjustTarget();assert.equal(calls,1);
  page.setData({profile:{...base,target_change_count:7}});page.refreshTargetPolicy();
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
