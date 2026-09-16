import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const read = name => readFileSync(new URL('../miniprogram/' + name, import.meta.url), 'utf8');
function freshness() {
  const mod = {exports:{}};
  vm.runInNewContext(read('utils/data-freshness.js'), {module:mod});
  return mod.exports;
}

test('page reuse expires, is owner/day scoped, and rejects writes that happened during a read', () => {
  const f = freshness(), start = f.stamp('owner');
  assert.equal(f.reusable(start, 'owner'), true);
  assert.equal(f.reusable(start, 'other'), false);
  assert.equal(f.reusable({...start, at:Date.now()-31000}, 'owner'), false);
  assert.equal(f.reusable({...start, at:Date.now()+1000}, 'owner'), false);
  assert.equal(f.reusable({...start, day:'yesterday'}, 'owner'), false);
  f.state.revision++;
  assert.equal(f.reusable(start, 'owner'), false);
});

function history() {
  let page, session = {user:{id:'owner'}}, calls = 0, fail = false, stop = 0;
  let pending;
  const f = freshness();
  const api = {requireSession:()=>session, getEntries:async()=>{
    calls++;
    if (fail) throw Error('offline');
    if (pending) return pending;
    return [{id:session.user.id, entry_date:'2026-09-16', entry_media:[]}];
  }};
  vm.runInNewContext(read('pages/history/history.js'), {
    require:p=>p.endsWith('localized-page')?d=>{page=d;}:p.endsWith('supabase')?api:p.endsWith('data-freshness')?f:require('../miniprogram/utils/'+p.split('/').pop()+'.js'),
    getApp:()=>({globalData:{locale:'zh'}}), wx:{stopPullDownRefresh(){stop++;}},
  });
  page.setData = function(values){Object.assign(this.data, values);};
  return {page, f, calls:()=>calls, stop:()=>stop, session:v=>{session=v;}, fail:v=>{fail=v;}, pending:v=>{pending=v;}};
}
test('returning to history reuses data; pull-refresh and successful mutations force reads', async () => {
  const h = history();
  await h.page.onShow(); await h.page.onShow();
  assert.equal(h.calls(),1);
  await h.page.load(true); assert.equal(h.calls(),2); assert.equal(h.stop(),1);
  h.f.state.revision++; await h.page.onShow(); assert.equal(h.calls(),3);
  h.page.freshness.at -= 31000; await h.page.onShow(); assert.equal(h.calls(),4);
});
test('failed reads are retryable; logout clears rows; switching owners cannot reuse rows', async () => {
  const h = history(); h.fail(true); await h.page.onShow();
  h.fail(false); await h.page.onShow(); assert.equal(h.calls(),2);
  h.session({user:{id:'other'}}); await h.page.onShow();
  assert.equal(h.calls(),3); assert.equal(h.page.data.entries[0].id,'other');
  h.session(null); await h.page.onShow(); assert.equal(h.page.data.entries.length,0);
});
test('a late previous-account response cannot overwrite the current account', async () => {
  const h = history(); let resolve;
  h.pending(new Promise(r=>{resolve=r;})); const old = h.page.onShow();
  h.pending(null); h.session({user:{id:'other'}}); await h.page.onShow();
  resolve([{id:'private-old', entry_date:'2026-09-16', entry_media:[]}]); await old;
  assert.equal(h.page.data.entries[0].id,'other');
});

test('report entry reads exclude media and sign no URLs; REST writes/logout invalidate views', async () => {
  const mod = {exports:{}}, f = freshness(), requests = [];
  vm.runInNewContext(read('utils/supabase.js'), {
    module:mod, getApp:()=>({globalData:{}}),
    require:p=>p.endsWith('runtime-config')?{loadRuntimeConfig:async()=>({supabaseUrl:'https://qa.invalid',publishableKey:'public'})}:p.endsWith('data-freshness')?f:{},
    wx:{getStorageSync:()=>({user:{id:'owner'},access_token:'test'}),removeStorageSync(){},request(o){requests.push(o);o.success({statusCode:200,data:[{id:'owner',entry_date:'2026-09-16',mood:'calm',category:'daily'}]});}},
  });
  await mod.exports.getEntries('owner',100,0,{includeMedia:false});
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/select=id,entry_date,mood,category/);
  assert.doesNotMatch(requests[0].url,/entry_media/);
  assert.equal(f.state.revision,0);
  await mod.exports.updateProfile('owner',{display_name:'Test'});
  assert.equal(f.state.revision,1);
  mod.exports.clearSession(); assert.equal(f.state.revision,2);
});

test('unchanged locale emits no repeated data or navigation bridge updates', async () => {
  let page, writes = 0, navigation = 0;
  const mod = {exports:{}};
  vm.runInNewContext(read('utils/localized-page.js'), {
    module:mod, Page:d=>{page=d;}, getCurrentPages:()=>[], getApp:()=>({globalData:{locale:'zh'}}),
    require:p=>p.endsWith('app-share')?d=>d:p.endsWith('share-card')?{formatDate:d=>d}:t=>t,
    wx:{setNavigationBarTitle(){navigation++;},setTabBarItem(){navigation++;}},
  });
  mod.exports({data:{modes:['gentle','clear']}});
  page.setData = function(values){writes++;Object.assign(this.data, values);};
  await page.onShow(); const firstWrites = writes, firstNavigation = navigation;
  await page.onShow(); assert.equal(writes,firstWrites); assert.equal(navigation,firstNavigation);
});
