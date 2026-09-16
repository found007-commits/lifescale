import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../miniprogram/pages/entry/entry.js',import.meta.url),'utf8');
function fixture(){
  let page,complete,pauses=0;
  vm.runInNewContext(source,{
    wx:{createVideoContext:()=>({pause(){pauses++;}})},
    require:path=>path.endsWith('localized-page')?value=>{page=value;}:path.endsWith('supabase')?{signEntryMedia:()=>new Promise(resolve=>{complete=resolve;})}:{}
  });
  page.data.media=[{id:'test',kind:'video',active:false,url:''}];
  page.setData=values=>{for(const[key,value]of Object.entries(values)){const match=key.match(/^media\[(\d+)\]\.(\w+)$/);if(match)page.data.media[Number(match[1])][match[2]]=value;else page.data[key]=value;}};
  return{page,complete:()=>complete({signed_url:'https://synthetic.invalid/video.mp4'}),pauses:()=>pauses};
}
const event={currentTarget:{dataset:{index:0}}};
test('closing media pauses and unmounts a video without altering the record',()=>{
  const f=fixture();Object.assign(f.page.data.media[0],{active:true,url:'test'});
  f.page.closeMedia(event);
  assert.equal(f.pauses(),1);assert.equal(f.page.data.media[0].active,false);assert.equal(f.page.data.media[0].url,'');assert.equal(f.page.data.media[0].id,'test');
});
test('closing during loading prevents a late response from reopening media; reopening still works',async()=>{
  const f=fixture();const pending=f.page.openMedia(event);f.page.closeMedia(event);f.complete();await pending;
  assert.equal(f.page.data.media[0].active,false);assert.equal(f.page.data.media[0].loading,false);
  const retry=f.page.openMedia(event);f.complete();await retry;assert.equal(f.page.data.media[0].active,true);
});
