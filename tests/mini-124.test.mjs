import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const source = (path) => readFileSync(new URL('../miniprogram/' + path, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function pageHarness(name, api = {}, extra = {}) {
  let page;
  const calls = [], app = { globalData: { profile: null, locale: 'en' } };
  const context = { console, setTimeout: () => 1, clearTimeout() {}, getApp: () => app, getCurrentPages: () => [],
    wx: { navigateTo: o => calls.push(o), reLaunch: o => calls.push(o), redirectTo: o => calls.push(o), switchTab: o => calls.push(o), navigateBack: () => calls.push({back:true}), showToast() {}, stopPullDownRefresh() {}, getFileSystemManager: () => ({unlink(){}}) },
    require(path) {
      if (path.endsWith('localized-page')) return definition => {page = definition;};
      if (path.endsWith('supabase')) return api;
      return require('../miniprogram/utils/' + path.split('/').pop() + '.js');
    }, ...extra };
  vm.runInNewContext(source(`pages/${name}/${name}.js`), context);
  page.setData = function(values) {Object.assign(this.data, values);};
  return { page, calls, context, app };
}

test('guest can compose locally; sign-in returns to the same draft and saves once without a profile', async () => {
  let session = null, writes = [], uploads = [];
  const {page,calls} = pageHarness('record', {restoreSession:()=>session, createEntry:async data=>writes.push(data), uploadEntryImage:async(...args)=>uploads.push(args)});
  page.onLoad(); page.onShow();
  assert.equal(calls.length,0);
  page.onContentInput({detail:{value:'A synthetic moment'}});
  page.setData({images:[{id:'synthetic-photo',tempFilePath:'local-test.jpg'}]});
  await page.saveEntry(); await page.saveEntry();
  assert.equal(writes.length,0); assert.equal(uploads.length,0);
  assert.equal(calls.length,1); assert.equal(calls[0].url,'/pages/auth/auth?returnTo=record');
  // Declining consent / returning does not erase the draft or leave Save stuck.
  page.onShow(); await page.saveEntry(); assert.equal(calls.length,2);
  session={user:{id:'qa-only'}};
  page.resumeSave=true;
  await page.onShow(); await page.saveEntry();
  assert.equal(writes.length,1); assert.equal(uploads.length,1);
  assert.equal(writes[0].content,'A synthetic moment');
  assert.equal(writes[0].userId,'qa-only'); assert.equal(page.data.saved,true);
  assert.equal('birth_date' in writes[0],false);
});

test('guest cannot save blank content, and a failed photo upload retries only the remaining photos', async () => {
  let session = null, writes = 0, uploaded = [], fail = true;
  const {page,calls} = pageHarness('record', {restoreSession:()=>session, createEntry:async()=>{writes++;}, uploadEntryImage:async(_u,_e,image)=>{if(image.id==='b' && fail) throw Error('synthetic network failure'); uploaded.push(image.id);}});
  page.onLoad();page.onShow();await page.saveEntry();assert.equal(calls.length,0);
  session={user:{id:'qa-only'}};page.onShow();
  page.setData({content:'Test',images:[{id:'a',tempFilePath:'a.jpg'},{id:'b',tempFilePath:'b.jpg'}]});
  await page.saveEntry();assert.equal(page.data.persisted,true);assert.equal(page.data.saved,false);
  fail=false;await page.saveEntry();assert.equal(writes,1);assert.deepEqual(uploaded,['a','b']);
});

test('a session appearing without the successful-login return signal never auto-uploads a guest draft', async () => {
  let session=null,writes=0;
  const {page}=pageHarness('record',{restoreSession:()=>session,createEntry:async()=>{writes++;}});
  page.onLoad();page.onShow();page.onContentInput({detail:{value:'Still local'}});await page.saveEntry();
  session={user:{id:'qa-only'}};await page.onShow();
  assert.equal(writes,0);assert.equal(page.data.content,'Still local');assert.equal(page.pendingSave,false);
});

test('writing starters are optional, never overwrite text and are translated in all supported languages', () => {
  const {page} = pageHarness('record');
  const {topics,questionAt} = require('../miniprogram/utils/record-prompts.js');
  const t = require('../miniprogram/utils/locale-copy.js');
  assert.equal(page.data.topic,-1);assert.equal(page.data.prompt,'');
  page.onContentInput({detail:{value:'My own words'}});
  page.chooseTopic({currentTarget:{dataset:{index:1}}});
  const first=page.data.prompt;page.nextPrompt();assert.notEqual(page.data.prompt,first);
  page.chooseTopic({currentTarget:{dataset:{index:-1}}});
  assert.equal(page.data.content,'My own words');assert.equal(page.data.prompt,'');
  assert.equal(questionAt(99),'');
  for (const topic of topics) for(const copy of [topic.label,...topic.questions]) {
    assert.notEqual(t(copy,'en'),copy);assert.equal(typeof t(copy,'zh-TW'),'string');
  }
});

test('auth return route is whitelisted, respects explicit opt-in, and preserves guest composer', async () => {
  let verifies=0;
  const {page,calls,context}=pageHarness('auth',{verifyOtp:async()=>{verifies++;return{user:{id:'qa-only'}};},getProfile:async()=>null});
  page.onLoad({returnTo:'https://evil.invalid'});assert.equal(page.returnTo,'');
  page.onLoad({returnTo:'record'});
  const composer={route:'pages/record/record'};
  context.getCurrentPages=()=>[composer,{route:'pages/auth/auth'}];
  page.setData({email:'qa@example.invalid',code:'123456'});
  await page.verifyCode();assert.equal(verifies,0);
  page.onConsentChange({detail:{value:['agree']}});await page.verifyCode();
  assert.deepEqual(calls,[{back:true}]);
  assert.equal(composer.resumeSave,true);
  page.onConsentChange({detail:{value:[]}});page.browseWithoutLogin();assert.equal(calls.length,2);
});

test('explicit timeline preview can still proceed to setup while ordinary first login goes to journal', async () => {
  for (const [returnTo,url] of [['onboarding','/pages/onboarding/onboarding'],['','/pages/history/history']]) {
    const {page,calls}=pageHarness('auth',{verifyOtp:async()=>({user:{id:'qa-only'}}),getProfile:async()=>null});
    page.onLoad({returnTo});page.setData({agreed:true,code:'123456'});await page.verifyCode();
    assert.equal(calls[0].url,url);
  }
});

test('profileless account can visit timeline and account controls without forced setup', async () => {
  const api={requireSession:()=>({user:{id:'qa-only',email:'qa@example.invalid'}}),getProfile:async()=>null};
  const dashboard=pageHarness('dashboard',api);await dashboard.page.load();
  assert.equal(dashboard.calls.length,0);assert.equal(dashboard.page.data.profile,null);assert.equal(dashboard.page.data.loading,false);
  const settings=pageHarness('settings',api);await settings.page.load();
  assert.equal(settings.page.data.error,'');assert.equal(settings.calls.length,0);
  assert.match(source('pages/settings/settings.wxml'),/<block wx:if="\{\{!loading\}\}">/);
  for(const action of ['exportData','signOut','removeAccount']) assert.match(source('pages/settings/settings.wxml'),new RegExp(`bindtap="${action}"`));
});

test('share copy includes only selected text and photos, never mutates the original or carries identity', () => {
  const {buildShareCopy}=require('../miniprogram/utils/share-selection.js');
  const original=Object.freeze({content:'SECRET first paragraph. Public last paragraph.',entry_date:'2026-09-08',mood:'calm',category:'daily',email:'SECRET',user_id:'SECRET',birth_date:'SECRET'});
  const choices=[{url:'photo-1',selected:false},{url:'photo-2',selected:true},{url:'photo-3',selected:false}];
  const result=buildShareCopy(original,'Public last paragraph.',choices);
  assert.deepEqual(result.imageUrls,['photo-2']);assert.doesNotMatch(JSON.stringify(result),/SECRET|photo-1|photo-3/);
  assert.match(original.content,/SECRET/);
  assert.equal(buildShareCopy(original,'',[choices[1]]).entry.content,'');
  assert.deepEqual(buildShareCopy(original,'Text only',[]).imageUrls,[]);
  assert.throws(()=>buildShareCopy(original,'  ',[]),/至少/);
});

test('share editor hides stale cards, applies a filtered copy, blocks sending while editing and supports cancel', async () => {
  const {page,context}=pageHarness('share');
  const entry={content:'SECRET paragraph\nShared paragraph',entry_date:'2026-09-08',mood:'calm',category:'daily',imageUrls:['a.jpg','b.jpg']};
  page.getOpenerEventChannel=()=>({on(_event,callback){callback({entry,locale:'en'});}});
  page.onLoad();page.setData({busy:false,cards:[{path:'stale-full.png'}]});
  let generated=0,sent=0;
  page.generate=async()=>{generated++;};context.wx.showShareImageMenu=()=>{sent++;};context.wx.saveImageToPhotosAlbum=()=>{sent++;};
  page.editSelection();page.onShareText({detail:{value:'Shared paragraph'}});page.togglePhoto({currentTarget:{dataset:{index:0}}});
  await page.shareImage();await page.saveImage();assert.equal(sent,0);
  page.cancelSelection();assert.match(page.selection.entry.content,/SECRET/);
  page.editSelection();assert.match(page.data.shareText,/SECRET/);
  page.onShareText({detail:{value:'Shared paragraph'}});page.togglePhoto({currentTarget:{dataset:{index:0}}});
  await page.applySelection();assert.equal(generated,1);assert.equal(page.selection.entry.content,'Shared paragraph');assert.deepEqual(plain(page.data.imageUrls),['b.jpg']);
  assert.match(entry.content,/SECRET/);assert.equal(page.photos,null);
  page.editSelection();page.onShareText({detail:{value:''}});page.togglePhoto({currentTarget:{dataset:{index:1}}});await page.applySelection();
  assert.equal(page.data.editing,true);assert.match(page.data.selectionError,/Keep some text|至少/);assert.equal(generated,1);
  assert.match(source('pages/share/share.wxml'),/<block wx:if="\{\{!editing\}\}">/);
});

test('repeat daily check-in uses ignore-duplicates so saving another entry needs no UPDATE policy', async () => {
  const requests=[], app={globalData:{}};
  const context={module:{exports:{}},getApp:()=>app,require(path){return path==='../config'?{apiBase:'https://qa.invalid'}:require('../miniprogram/utils/life.js');},wx:{
    getStorageSync:()=>({access_token:'test-only',user:{id:'qa-only'}}),
    request(o){requests.push(o);o.success({statusCode:200,data:o.url.endsWith('/config')?{supabaseUrl:'https://qa.invalid',publishableKey:'test-only'}:[{id:'qa-entry'}]});}
  }};
  vm.runInNewContext(source('utils/supabase.js'),context);
  await context.module.exports.createEntry({id:'qa-entry',userId:'qa-only',content:'Test',mood:'calm',category:'daily'});
  const checkin=requests.find(o=>o.url.includes('/checkins?'));
  assert.match(checkin.header.Prefer,/resolution=ignore-duplicates/);
  assert.equal(requests.some(o=>o.url.includes('/profiles')),false);
});

test('actual share renderer reloads only selected photos and paints only edited text in both layouts', async () => {
  for (const layout of ['separate','overlay']) {
    const {page,context}=pageHarness('share');
    const texts=[],photos=[],decoded=[];
    const ctx={measureText:text=>({width:Array.from(text).length*17}),fillRect(){},fillText:text=>texts.push(text),drawImage:photo=>photos.push(photo.src)};
    const canvas={getContext:()=>ctx,createImage(){return{width:400,height:300,set src(value){this.path=value;this.onload();},get src(){return this.path;}};}};
    context.wx.getImageInfo=o=>{decoded.push(o.src);o.success({path:o.src,width:400,height:300});};
    context.wx.canvasToTempFilePath=o=>o.success({tempFilePath:'test-only-output.png'});
    const entry={content:'SECRET never share',entry_date:'2026-09-08',mood:'calm',category:'daily',imageUrls:['/private-photo.jpg','/chosen-photo.jpg']};
    page.getOpenerEventChannel=()=>({on(_event,callback){callback({entry,locale:'en'});}});
    page.onLoad();page.canvas=canvas;page.setData({busy:false,layout});page.editSelection();
    page.onShareText({detail:{value:'Chosen words'}});page.togglePhoto({currentTarget:{dataset:{index:0}}});
    await page.applySelection();
    assert.equal(page.data.error,'');assert.equal(page.data.cards.length,1);
    assert.deepEqual(decoded,['/chosen-photo.jpg']);assert.deepEqual(photos,['/chosen-photo.jpg']);
    assert.ok(texts.includes('Chosen words'));assert.ok(texts.includes('Calm · Daily life'));
    assert.doesNotMatch(texts.join(' '),/SECRET/);assert.equal(entry.content,'SECRET never share');
  }
});
