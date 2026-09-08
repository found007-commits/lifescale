import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../miniprogram/' + file, import.meta.url), 'utf8');
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

test('cold launch declares auth first; public browse primary action also asks for login', () => {
  assert.equal(JSON.parse(read('app.json')).pages[0], 'pages/auth/auth');
  assert.match(read('pages/index/index.wxml'), /hero-button" bindtap="goLogin"/);
  assert.doesNotMatch(read('pages/index/index.wxml'), /bindtap="startWriting"/);
});

test('public runtime configuration is single-flight, memory-only, and retryable after failure', async () => {
  const requests = [], runtimeModule = {exports:{}};
  vm.runInNewContext(read('utils/runtime-config.js'), {module:runtimeModule, require:()=>({apiBase:'https://qa.invalid'}), wx:{request:o=>requests.push(o)}});
  const load = runtimeModule.exports.loadRuntimeConfig;
  const a = load('zh_CN'), b = load();
  assert.equal(a,b); assert.equal(requests.length,1); assert.equal(requests[0].timeout,4000);
  requests[0].success({statusCode:200,data:{supabaseUrl:'https://qa.invalid',publishableKey:'public-test',locale:'zh',unwanted:'not retained'}});
  assert.equal((await a).locale,'zh'); assert.equal('unwanted' in await b,false);
  await load(); assert.equal(requests.length,1);
  const second = {exports:{}};
  vm.runInNewContext(read('utils/runtime-config.js'), {module:second,require:()=>({apiBase:'https://qa.invalid'}),wx:{request:o=>requests.push(o)}});
  const failed=second.exports.loadRuntimeConfig();requests[1].fail();await assert.rejects(failed);
  const retry=second.exports.loadRuntimeConfig();assert.equal(requests.length,3);
  requests[2].success({statusCode:503,data:{}});await assert.rejects(retry);
});

test('startup uses cached locale immediately then updates from IP without identity requests', async () => {
  let app, resolve, requested=0;
  const stored=[];
  const pending=new Promise(r=>{resolve=r;});
  vm.runInNewContext(read('app.js'), {App:d=>{app=d;},require:p=>p.endsWith('supabase')?{restoreSession:()=>null}:{loadRuntimeConfig:()=>{requested++;return pending;}},wx:{
    getAppBaseInfo:()=>({language:'en'}),getStorageSync:()=> 'zh-TW',setStorageSync:(...args)=>stored.push(args),
  }});
  app.onLaunch(); assert.equal(app.globalData.locale,'zh-TW');assert.equal(requested,1);
  resolve({locale:'zh'});await app.localeReady;
  assert.equal(app.globalData.locale,'zh');assert.deepEqual(stored,[['lifescale:startup-locale','zh']]);
});

function auth(session) {
  let page, checks=0;
  const routes=[];
  const sandbox={Page:d=>{page=d;},getCurrentPages:()=>[],clearInterval(){},require:p=>{
    if(p.endsWith('localized-page'))return d=>{page=d;};
    if(p.endsWith('supabase'))return {restoreSession:()=>session};
    if(p.endsWith('wechat-auth'))return {visibleEmail:e=>e,wechatStatus:async()=>{checks++;return{enabled:true};}};
    return x=>x;
  },wx:{switchTab:o=>routes.push(o.url),reLaunch:o=>routes.push(o.url),navigateBack:()=>routes.push('back')}};
  vm.runInNewContext(read('pages/auth/auth.js'),sandbox);
  page.setData=function(d){Object.assign(this.data,d);};
  return {page,routes,checks:()=>checks};
}
test('existing session routes locally without profile or readiness requests; guest sees unchecked login', async () => {
  const h=auth({user:{id:'synthetic'},access_token:'test-only',refresh_token:'test-only'});
  h.page.onLoad();assert.deepEqual(h.routes,['/pages/dashboard/dashboard']);assert.equal(h.checks(),0);
  const g=auth(null);g.page.onLoad();assert.equal(g.page.data.agreed,false);assert.equal(g.page.data.wechatChecking,true);
  await tick();assert.equal(g.page.data.wechatEnabled,true);assert.equal(g.page.data.wechatChecking,false);assert.equal(g.routes.length,0);
  g.page.browseWithoutLogin();assert.deepEqual(g.routes,['/pages/index/index?browse=1']);
  const expired=auth({user:{id:'synthetic'},access_token:'test-only',expires_at:1});expired.page.onLoad();assert.equal(expired.routes.length,0);
});
test('existing-session fast path does not intercept binding or a pending record', () => {
  for(const options of [{mode:'bind'},{returnTo:'record'}]){
    const h=auth({user:{id:'synthetic',email:'qa@example.invalid'},access_token:'test-only',refresh_token:'test-only'});
    h.page.onLoad(options);assert.equal(h.routes.length,0);assert.equal(h.checks(),1);
  }
});
test('old shared homepage opens login; refusing consent can still browse without a redirect loop', () => {
  for(const [options,expected] of [[{},'/pages/auth/auth'],[{browse:'1'},null]]){
    let page;const routes=[];
    vm.runInNewContext(read('pages/index/index.js'),{require:p=>p.endsWith('localized-page')?d=>{page=d;}:p.endsWith('supabase')?{restoreSession:()=>null}:{localDateString:()=> '2026-09-08'},wx:{redirectTo:o=>routes.push(o.url)}});
    page.onLoad(options);page.onShow();assert.deepEqual(routes,expected?[expected]:[]);
  }
});

test('locale lookup never blocks page work; late updates respect saved preference and page lifetime', async () => {
  let wrapper, resolveLocale, resolveWork, calls=0, updates=0, hidden=0;
  const app={globalData:{locale:'en'},localeReady:new Promise(r=>{resolveLocale=r;})};
  const work=new Promise(r=>{resolveWork=r;});
  const pageModule={exports:{}};
  vm.runInNewContext(read('utils/localized-page.js'),{module:pageModule,Page:d=>{wrapper=d;},getApp:()=>app,getCurrentPages:()=>[],require:p=>p.endsWith('app-share')?d=>d:p.endsWith('share-card')?{formatDate:(_d,l)=>l}:x=>x,wx:{setNavigationBarTitle(){},setTabBarItem(){}}});
  pageModule.exports({data:{entries:[{entry_date:'2026-09-08',dateLabel:'old'}]},onShow(){calls++;return work;},onHide(){hidden++;}});
  wrapper.setData=function(d){updates++;for(const [key,value] of Object.entries(d)){
    const match=key.match(/^(entries|recentEntries)\[(\d+)\]\.dateLabel$/);
    if(match)this.data[match[1]][Number(match[2])].dateLabel=value;else this.data[key]=value;
  }};
  const showing=wrapper.onShow();assert.equal(calls,1);assert.equal(wrapper.data.locale,'en');
  app.globalData.locale='zh';app.globalData.profile={locale:'zh-TW'};resolveLocale();await tick();
  assert.equal(wrapper.data.locale,'zh-TW');assert.equal(wrapper.data.entries[0].dateLabel,'zh-TW');
  wrapper.onHide();const before=updates;resolveWork();await showing;assert.equal(updates,before);assert.equal(hidden,1);
});
