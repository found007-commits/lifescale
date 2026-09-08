import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const session={user:{id:'synthetic',email:'synthetic@wechat.lifescale.invalid'}};
function harness(name,api={}) {
  let page;const calls=[],app={globalData:{locale:'zh',profile:null}};
  const context={console,setTimeout:()=>1,getApp:()=>app,getCurrentPages:()=>[],
    wx:{getStorageSync:()=>null,removeStorageSync:key=>calls.push({remove:key}),stopPullDownRefresh(){},showToast(){},
      navigateTo:o=>calls.push(o),reLaunch:o=>calls.push(o),switchTab:o=>calls.push(o),navigateBack:()=>calls.push({back:true})},
    require(path){
      if(path.endsWith('localized-page'))return value=>{page=value;};
      if(path.endsWith('supabase'))return {requireSession:()=>session,restoreSession:()=>session,...api};
      return require('../miniprogram/utils/'+path.split('/').pop()+'.js');
    }};
  vm.runInNewContext(readFileSync(new URL('../miniprogram/pages/'+name+'/'+name+'.js',import.meta.url),'utf8'),context);
  page.setData=function(values){Object.assign(this.data,values);};
  return{page,context,calls,app};
}
test('setup completion must belong to current account; legacy email users remain optional',()=>{
  const {requiresWechatSetup}=require('../miniprogram/utils/setup-policy.js');
  assert.equal(requiresWechatSetup(session,null),true);
  assert.equal(requiresWechatSetup(session,{id:'other',onboarding_completed:true}),true);
  assert.equal(requiresWechatSetup(session,{id:'synthetic',onboarding_completed:true}),false);
  assert.equal(requiresWechatSetup({user:{id:'email',email:'qa@example.invalid'}},null),false);
});
test('reopening with incomplete WeChat profile returns to setup before reading entries',async()=>{
  let reads=0;const h=harness('dashboard',{getProfile:async()=>null,getEntries:async()=>{reads++;return[];}});
  await h.page.load();assert.equal(reads,0);
  assert.equal(h.calls[0].url,'/pages/onboarding/onboarding?required=1');
});
test('required setup cannot skip; validates fields and retries without clearing user input',async()=>{
  let writes=0,fail=true;
  const h=harness('onboarding',{createProfile:async data=>{writes++;if(fail)throw Error('Synthetic failure');assert.equal(data.target_age,88);assert.equal(data.onboarding_completed,true);}});
  h.page.onLoad();h.page.skipSetup();assert.equal(h.calls.length,0);
  await h.page.saveProfile();assert.equal(writes,0);
  h.page.setData({displayName:'Local test',birthDate:'1990-01-01',genderIndex:0,targetAge:'NaN',confirmed:true});
  await h.page.saveProfile();assert.equal(writes,0);
  h.page.setData({targetAge:'88'});await h.page.saveProfile();
  assert.equal(h.page.data.error,'Synthetic failure');assert.equal(h.page.data.displayName,'Local test');assert.equal(h.calls.length,0);
  fail=false;await h.page.saveProfile();assert.equal(writes,2);
  assert.equal(h.calls.at(-1).url,'/pages/dashboard/dashboard');
});
test('unfinished setup guards record writes; successful setup resumes the same draft exactly once',async()=>{
  let profile=null,writes=0;
  const api={getProfile:async()=>profile,createEntry:async data=>{writes++;assert.equal(data.content,'My local draft');},createProfile:async data=>{profile=data;}};
  const record=harness('record',api);record.page.onLoad();record.page.onShow();record.page.setData({content:'My local draft'});
  await record.page.saveEntry();assert.equal(writes,0);assert.equal(record.page.pendingSave,true);
  assert.equal(record.calls[0].url,'/pages/onboarding/onboarding?required=1&returnTo=record');
  const setup=harness('onboarding',api);record.page.route='pages/record/record';
  setup.context.getCurrentPages=()=>[record.page,setup.page];
  setup.page.onLoad({required:'1',returnTo:'record'});
  setup.page.setData({birthDate:'1990-01-01',targetAge:'88',genderIndex:0,confirmed:true});
  await setup.page.saveProfile();assert.equal(record.page.resumeSave,true);assert.equal(setup.calls.at(-1).back,true);
  await record.page.onShow();await record.page.saveEntry();assert.equal(writes,1);assert.equal(record.page.data.saved,true);
});
