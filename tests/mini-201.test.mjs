import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../miniprogram/'+path,import.meta.url),'utf8');
function pageFixture(name,api) {
  let page;
  vm.runInNewContext(read(`pages/${name}/${name}.js`),{setTimeout:()=>1,clearTimeout(){},getApp:()=>({globalData:{}}),wx:{showToast(){},getFileSystemManager:()=>({unlink(){}})},
    require:path=>path.endsWith('localized-page')?definition=>{page=definition;}:path.endsWith('supabase')?api:require('../miniprogram/utils/'+path.split('/').pop()+'.js'),
  });
  page.setData=values=>{for(const [key,value] of Object.entries(values)) {
    const match=key.match(/^media\[(\d+)\]\.(\w+)$/);
    if(match)page.data.media[Number(match[1])][match[2]]=value;else page.data[key]=value;
  }};
  return page;
}
test('media-only GIF and video entry saves without words; failed second upload reuses entry and file IDs',async()=>{
  const writes=[],uploads=[];let fail=true;
  const p=pageFixture('record',{restoreSession:()=>({user:{id:'owner',email:'test@example.invalid'}}),createEntry:async data=>writes.push(data),uploadEntryImage:async(_u,_e,item)=>{
    if(item.id==='video'&&fail)throw Error('Synthetic failure');uploads.push(item.id);
  }});
  p.onLoad();p.onShow();
  p.setData({content:'',images:[{id:'gif',tempFilePath:'/test.gif',mediaType:'image/gif'},{id:'video',tempFilePath:'/test.mp4',mediaType:'video/mp4'}]});
  await p.saveEntry();assert.equal(writes.length,1);assert.equal(writes[0].content,'');assert.equal(p.data.saved,false);
  fail=false;await p.saveEntry();await p.saveEntry();
  assert.equal(writes.length,1);assert.deepEqual(uploads,['gif','video']);assert.equal(p.data.saved,true);
});
test('opening detail performs no media signing until tap, and media retry requests a fresh URL',async()=>{
  let signs=0,fail=true;
  const p=pageFixture('entry',{requireSession:()=>({user:{id:'owner'}}),getEntry:async()=>({id:'entry',entry_media:[{id:'video',media_type:'video/mp4',storage_path:'owner/entry/video.mp4',created_at:'2026-09-13'}]}),getComments:async()=>[],signEntryMedia:async()=>{signs++;if(fail)throw Error('network');return{signed_url:'https://synthetic.invalid/video'};}});
  p.entryId='entry';await p.load();assert.equal(signs,0);assert.equal(p.data.media[0].active,undefined);
  const event={currentTarget:{dataset:{index:0}}};await p.openMedia(event);assert.equal(p.data.media[0].loading,false);assert.ok(p.data.media[0].error);
  fail=false;await p.openMedia(event);assert.equal(signs,2);assert.equal(p.data.media[0].active,true);
  p.mediaError(event);assert.equal(p.data.media[0].active,false);assert.equal(p.data.media[0].url,'');
});
test('reply failure retains draft and retry ID; success clears draft and duplicate taps are ignored',async()=>{
  const writes=[];let fail=true,complete;
  const p=pageFixture('entry',{getComments:async()=>[],addComment:async(...args)=>{
    writes.push(args);if(fail)throw Error('network');await new Promise(resolve=>{complete=resolve;});
  }});
  p.entryId='entry';p.setData({comments:[{id:'parent',content:'Original'}],text:'My later thought'});
  p.reply({currentTarget:{dataset:{id:'parent'}}});await p.sendComment();
  assert.equal(p.data.text,'My later thought');assert.equal(p.data.sending,false);assert.equal(p.data.replyId,'parent');
  fail=false;const sending=p.sendComment();await p.sendComment();complete();await sending;
  assert.equal(writes.length,2);assert.equal(writes[0][3],writes[1][3]);assert.equal(writes[1][2],'parent');assert.equal(p.data.text,'');assert.equal(p.data.replyId,'');
});
