import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL('../miniprogram/' + path, import.meta.url), 'utf8');
function harness(result = {needsAccountChoice:true}) {
  let page;
  const calls={wechat:[],send:[],accept:0,profile:[],destinations:[],modals:[]};
  const wx={showToast(){},navigateBack:()=>calls.destinations.push('back'),reLaunch:o=>calls.destinations.push(o.url),redirectTo:o=>calls.destinations.push(o.url),
    showModal(o){calls.modals.push(o); if(o.success)o.success({confirm:true}); if(o.complete)o.complete({confirm:true});}};
  const api={wechatStatus:async()=>({enabled:true}),wechatAuth:async(...args)=>{calls.wechat.push(args);return result;},acceptWechatSession:r=>{calls.accept++;return r.session;},visibleEmail:e=>e,errorText:e=>e.message};
  const context={wx,setInterval:()=>1,clearInterval(){},getCurrentPages:()=>[],require(path){
    if(path.endsWith('localized-page'))return definition=>{page=definition;};
    if(path.endsWith('wechat-auth'))return api;
    if(path.endsWith('locale-copy'))return require('../miniprogram/utils/locale-copy.js');
    return {sendOtp:async(...args)=>calls.send.push(args),verifyOtp:async()=>({user:{id:'original'}}),restoreSession:()=>({user:{id:'original',email:'old@example.invalid'}}),getProfile:async id=>{calls.profile.push(id);return{onboarding_completed:true};}};
  }};
  vm.runInNewContext(source('pages/auth/auth.js'),context);
  page.setData=function(values){Object.assign(this.data,values);};
  return {page,calls,context,api};
}
test('WeChat is never invoked before explicit consent; unknown identity shows choice without accepting a session',async()=>{
  const h=harness();h.page.onLoad();await h.page.loginWithWechat();await h.page.createWechatAccount();
  assert.equal(h.calls.wechat.length,0);assert.equal(h.calls.modals.length,0);
  h.page.setData({agreed:true});await h.page.loginWithWechat();
  assert.equal(h.page.data.accountChoice,true);assert.equal(h.calls.accept,0);assert.equal(h.calls.destinations.length,0);
});
test('existing-account path sends OTP with account creation disabled and binds before storing original session',async()=>{
  const h=harness({session:{user:{id:'original'}},bound:true});h.page.onLoad();h.page.chooseExisting();
  h.page.setData({agreed:true,email:'old@example.invalid',code:'123456'});
  await h.page.sendCode();assert.equal(h.calls.send[0][1],false);
  await h.page.verifyCode();assert.equal(h.calls.wechat[0][0],'bind');assert.equal(h.calls.wechat[0][2],false);
  assert.equal(h.calls.accept,1);assert.deepEqual(h.calls.profile,['original']);
  assert.equal(h.calls.destinations[0],'/pages/dashboard/dashboard');
});
test('binding conflict is explained before opening the verified original email account',async()=>{
  const h=harness({session:{user:{id:'original'}},bindingConflict:true});
  h.page.chooseExisting();h.page.setData({agreed:true,email:'old@example.invalid',code:'123456'});
  await h.page.verifyCode();assert.match(h.calls.modals[0].content,/不能自动合并/);
  assert.deepEqual(h.calls.profile,['original']);assert.equal(h.calls.accept,1);
});
test('settings bind and unlink use authenticated requests and return without onboarding',async()=>{
  for(const mode of ['bind','unbind']){
    const h=harness({session:{user:{id:'original'}},unbound:mode==='unbind'});h.page.onLoad({mode});
    h.page.setData({agreed:true,code:'123456'});await h.page.verifyCode();
    assert.equal(h.calls.wechat[0][0],mode);assert.equal(h.calls.wechat[0][2],true);
    assert.equal(h.calls.profile.length,0);assert.deepEqual(h.calls.destinations,['back']);
  }
});
test('new user requires an extra explicit confirmation; bound WeChat preserves draft return route',async()=>{
  const h=harness({session:{user:{id:'original'}}});h.page.onLoad({returnTo:'record'});
  const composer={route:'pages/record/record'};h.context.getCurrentPages=()=>[composer,{}];h.page.setData({agreed:true});
  await h.page.createWechatAccount();assert.match(h.calls.modals[0].content,/不会包含/);
  assert.equal(h.calls.wechat[0][1].newAccountConfirmed,true);assert.equal(composer.resumeSave,true);
  assert.deepEqual(h.calls.destinations,['back']);
});
test('client adapter never stores login codes; private placeholder email is never displayed',async()=>{
  const code=source('utils/wechat-auth.js');const calls=[];let accepted=0;
  const context={module:{exports:{}},require(path){return path==='../config'?{apiBase:'https://test.invalid'}:path.endsWith('supabase')?{storeSession:s=>{accepted++;return s;},restoreSession:()=>null}:x=>x;},wx:{
    login(o){calls.push('wx.login');o.success({code:'test-code'});},request(o){calls.push(o);o.success({statusCode:200,data:{needsAccountChoice:true}});}
  }};
  vm.runInNewContext(code,context);const api=context.module.exports;
  await assert.rejects(api.wechatAuth('login',{agreed:false}));assert.equal(calls.length,0);
  const result=await api.wechatAuth('login',{agreed:true});assert.equal(result.needsAccountChoice,true);assert.equal(accepted,0);
  assert.equal(calls[1].data.code,'test-code');assert.equal(api.visibleEmail('hash@wechat.lifescale.invalid'),'');
  assert.doesNotMatch(code,/setStorageSync|session_key|AppSecret/);
});
