import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../miniprogram/' + name, import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(paths = ['owner/entry/photo.jpg']) {
  const requests = [], files = new Set(paths);
  const state = { row: true, storageFail: false, rowFail: false, loseStorageResponse: false, session: { access_token: 'synthetic', user: { id: 'owner' } } };
  const entry = { id: 'entry', user_id: 'owner', entry_media: paths.map(storage_path => ({storage_path})) };
  const mod = {exports:{}};
  vm.runInNewContext(read('utils/supabase.js'), {
    module:mod,
    require:p=>p.endsWith('runtime-config')?{loadRuntimeConfig:async()=>({supabaseUrl:'https://synthetic.invalid',publishableKey:'synthetic-public'})}:p.endsWith('data-freshness')?{state:{revision:0}}:{},
    wx:{getStorageSync:()=>state.session,request(o){
      requests.push(o);
      if(o.url.includes('/storage/')) {
        // Reproduce the parser failure from 2.0.4; do not silently accept bad requests.
        if(o.data === undefined && o.header['Content-Type'] === 'application/json') return o.success({statusCode:400,data:{message:'Body cannot be empty when content-type is set to application/json'}});
        assert.equal(o.url,'https://synthetic.invalid/storage/v1/object/entry-media');
        assert.equal(o.method,'DELETE');assert.equal(o.header['Content-Type'],'application/json');
        assert.ok(Array.isArray(o.data.prefixes));assert.ok(o.data.prefixes.length>0);
        if(state.storageFail)return o.success({statusCode:503,data:{message:'Storage unavailable'}});
        for(const path of o.data.prefixes) files.delete(path);
        if(state.loseStorageResponse){state.loseStorageResponse=false;return o.fail({errMsg:'Network response lost'});}
        return o.success({statusCode:200,data:[]});
      }
      assert.equal(o.method,'DELETE');
      assert.equal(o.url,'https://synthetic.invalid/rest/v1/life_entries?id=eq.entry&user_id=eq.owner');
      assert.equal(o.data,undefined);assert.equal(o.header['Content-Type'],undefined);
      if(state.rowFail)return o.success({statusCode:503,data:{message:'Row unavailable'}});
      state.row=false;o.success({statusCode:204,data:''});
    }}
  });
  return{api:mod.exports,requests,files,state,entry};
}
test('media deletion sends exact JSON paths before deleting the owned row; unrelated files survive',async()=>{
  const paths=['owner/entry/photo.jpg','owner/entry/clip.mp4','owner/entry/animation.gif'];
  const f=fixture(paths);f.files.add('owner/other/keep.jpg');
  await f.api.deleteEntry(f.entry);
  assert.deepEqual(clone(f.requests[0].data),{prefixes:paths});
  assert.equal(f.requests.length,2);assert.equal(f.state.row,false);
  assert.deepEqual([...f.files],['owner/other/keep.jpg']);
});
test('text-only deletion skips storage; duplicate attachment paths are removed once',async()=>{
  const f=fixture([]);await f.api.deleteEntry(f.entry);assert.equal(f.requests.length,1);
  const d=fixture(['owner/entry/a.jpg','owner/entry/a.jpg']);await d.api.deleteEntry(d.entry);
  assert.deepEqual(clone(d.requests[0].data.prefixes),['owner/entry/a.jpg']);
});
test('storage failure does not delete the record, and retry succeeds',async()=>{
  const f=fixture();f.state.storageFail=true;
  await assert.rejects(f.api.deleteEntry(f.entry),/Storage unavailable/);
  assert.equal(f.requests.length,1);assert.equal(f.state.row,true);assert.equal(f.files.size,1);
  f.state.storageFail=false;await f.api.deleteEntry(f.entry);assert.equal(f.state.row,false);
});
test('retry works after storage deletion succeeded but its response was lost or row deletion failed',async()=>{
  for(const failure of ['loseStorageResponse','rowFail']){
    const f=fixture();f.state[failure]=true;
    await assert.rejects(f.api.deleteEntry(f.entry));assert.equal(f.state.row,true);assert.equal(f.files.size,0);
    f.state[failure]=false;await f.api.deleteEntry(f.entry);assert.equal(f.state.row,false);
  }
});
test('missing session, wrong owner and malformed paths cannot initiate deletion',async()=>{
  for(const mode of ['session','owner','path']){
    const f=fixture();
    if(mode==='session')f.state.session=null;
    if(mode==='owner')f.entry.user_id='other';
    if(mode==='path')f.entry.entry_media[0].storage_path='other/entry/a.jpg';
    await assert.rejects(f.api.deleteEntry(f.entry));assert.equal(f.requests.length,0);assert.equal(f.state.row,true);
  }
});
