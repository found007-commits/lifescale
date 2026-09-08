import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL('../miniprogram/' + path, import.meta.url), 'utf8');
function harness(result = {needsAccountChoice:true}, profile = {onboarding_completed:true}) {
  let page;
  const calls={wechat:[],send:[],accept:0,profile:[],destinations:[],modals:[]};
  const wx={showToast(){},navigateBack:()=>calls.destinations.push('back'),reLaunch:o=>calls.destinations.push(o.url),redirectTo:o=>calls.destinations.push(o.url),
    showModal(o){calls.modals.push(o); if(o.success)o.success({confirm:true}); if(o.complete)o.complete({confirm:true});}};
  const api={wechatStatus:async()=>({enabled:true}),wechatAuth:async(...args)=>{calls.wechat.push(args);return api.request ? api.request(...args) : result;},acceptWechatSession:r=>{calls.accept++;return r.session;},visibleEmail:e=>e,errorText:e=>e.message};
  const context={wx,setInterval:()=>1,clearInterval(){},getCurrentPages:()=>[],require(path){
    if(path.endsWith('localized-page'))return definition=>{page=definition;};
    if(path.endsWith('wechat-auth'))return api;
    if(path.endsWith('locale-copy'))return require('../miniprogram/utils/locale-copy.js');
    if(path.endsWith('setup-policy'))return require('../miniprogram/utils/setup-policy.js');
    return {sendOtp:async(...args)=>calls.send.push(args),verifyOtp:async()=>({user:{id:'original'}}),restoreSession:()=>({user:{id:'original',email:'old@example.invalid'}}),getProfile:async id=>{calls.profile.push(id);return profile;}};
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
test('1.3.7 bound WeChat signs directly into original account without email, OTP, choice or new-account prompt',async()=>{
  const h=harness({session:{user:{id:'original'}}});h.page.onLoad();
  h.page.setData({agreed:true,email:'',code:''});await h.page.loginWithWechat();
  assert.deepEqual(h.calls.wechat.map(args=>args[0]),['login']);
  assert.equal(h.calls.wechat[0][1].newAccountConfirmed,false);
  assert.equal(h.calls.send.length,0);assert.equal(h.calls.modals.length,0);
  assert.equal(h.page.data.accountChoice,false);assert.equal(h.page.data.binding,false);
  assert.equal(h.calls.accept,1);assert.deepEqual(h.calls.profile,['original']);
  assert.deepEqual(h.calls.destinations,['/pages/dashboard/dashboard']);
});
test('1.3.7 email sign-in works independently even if WeChat is unavailable or unbound',async()=>{
  for(const unbound of [false,true]) {
    const h=harness();h.page.onLoad();h.page.setData({agreed:true,wechatEnabled:false});
    if(unbound)await h.page.loginWithWechat(); // synthetic unknown identity, not a session
    const before=h.calls.wechat.length;
    h.page.setData({email:'old@example.invalid',code:'123456'});
    await h.page.sendCode();await h.page.verifyCode();
    assert.deepEqual(h.calls.send,[['old@example.invalid',true]]);
    assert.equal(h.calls.wechat.length,before);assert.equal(h.calls.accept,0);
    assert.equal(h.calls.modals.length,0);assert.deepEqual(h.calls.profile,['original']);
    assert.deepEqual(h.calls.destinations,['/pages/dashboard/dashboard']);
  }
});
test('1.3.7 ordinary login offers alternatives without instructing all users to bind',()=>{
  const wxml=source('pages/auth/auth.wxml');
  assert.match(wxml,/选择一种方式登录。/);assert.match(wxml,/或用邮箱登录/);
  assert.doesNotMatch(wxml,/以前记录过？首次使用微信时请绑定原邮箱/);
  assert.match(wxml,/wx:if="\{\{accountChoice\}\}"/);
  const t=require('../miniprogram/utils/locale-copy.js');
  for(const text of ['选择一种方式登录。','或用邮箱登录','可使用邮箱登录','微信已绑定，可直接登录']) {
    assert.doesNotMatch(t(text,'en'),/[\u4e00-\u9fff]/);
    assert.ok(t(text,'zh-TW').length>0);
  }
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
test('explicit new-user choice needs no native confirmation; existing account preserves draft return route',async()=>{
  const h=harness({session:{user:{id:'original'}}});h.page.onLoad({returnTo:'record'});
  const composer={route:'pages/record/record'};h.context.getCurrentPages=()=>[composer,{}];h.page.setData({agreed:true,accountChoice:true});
  await h.page.createWechatAccount();assert.equal(h.calls.modals.length,0);
  assert.equal(h.calls.wechat[0][1].newAccountConfirmed,true);assert.equal(composer.resumeSave,true);
  assert.deepEqual(h.calls.destinations,['back']);
});
test('1.3.8 new WeChat choice directly creates and opens required setup in every language',async()=>{
  for(const locale of ['zh','zh-TW','en']) {
    const h=harness({session:{user:{id:'new',email:'new@wechat.lifescale.invalid'}}},null);
    h.page.setData({agreed:true,accountChoice:true,locale});
    await h.page.createWechatAccount();
    assert.equal(h.calls.modals.length,0);
    assert.deepEqual(h.calls.wechat.map(args=>args[0]),['create']);
    assert.equal(h.calls.wechat[0][1].newAccountConfirmed,true);
    assert.deepEqual(h.calls.destinations,['/pages/onboarding/onboarding?required=1']);
    assert.equal(h.page.data.wechatBusy,false);
  }
});
test('1.3.8 incomplete WeChat setup takes priority over resuming a draft',async()=>{
  const h=harness({session:{user:{id:'new',email:'new@wechat.lifescale.invalid'}}},null);
  h.page.onLoad({returnTo:'record'});
  const composer={route:'pages/record/record',pendingSave:true};h.context.getCurrentPages=()=>[composer,{}];
  h.page.setData({agreed:true});await h.page.loginWithWechat();
  assert.equal(composer.resumeSave,undefined);
  assert.deepEqual(h.calls.destinations,['/pages/onboarding/onboarding?required=1&returnTo=record']);
});
test('1.3.8 create has a double-tap lock, explicit choice gate, and visible retryable errors',async()=>{
  const h=harness();h.page.setData({agreed:true});await h.page.createWechatAccount();
  assert.equal(h.calls.wechat.length,0);
  h.page.setData({accountChoice:true});let finish,count=0;
  h.api.request=()=>{count++;return new Promise((_,reject)=>{finish=reject;});};
  const pending=h.page.createWechatAccount();await h.page.createWechatAccount();assert.equal(count,1);
  finish(Error('Synthetic failure'));await pending;
  assert.equal(h.page.data.error,'Synthetic failure');assert.equal(h.page.data.wechatBusy,false);
  h.api.request=async()=>({session:{user:{id:'original'}}});await h.page.createWechatAccount();
  assert.deepEqual(h.calls.destinations,['/pages/dashboard/dashboard']);
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
