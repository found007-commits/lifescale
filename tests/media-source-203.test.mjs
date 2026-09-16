import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('mini selects from phone album only, ignores legacy chat source and preserves draft on cancel',async()=>{
  let page,options;
  vm.runInNewContext(read('miniprogram/pages/record/record.js'),{
    getApp:()=>({globalData:{}}),
    wx:{chooseMedia:o=>{options=o;o.fail({errMsg:'chooseMedia:fail cancel'});}},
    require:p=>p.endsWith('localized-page')?d=>{page=d;}:p.endsWith('supabase')?{}:require('../miniprogram/utils/'+p.split('/').pop()+'.js'),
  });
  page.setData=values=>Object.assign(page.data,values);
  page.data.content='Private draft'; page.data.images=[{id:'existing'}];
  await page.chooseImage({currentTarget:{dataset:{source:'files'}}});
  assert.deepEqual(Array.from(options.sourceType),['album']);
  assert.deepEqual(Array.from(options.mediaType),['image','video']);
  assert.deepEqual(Array.from(options.sizeType),['original']);
  assert.equal(page.data.content,'Private draft');assert.equal(page.data.images.length,1);
  assert.equal(page.data.processing,false);assert.equal(page.picking,false);assert.equal(page.data.error,'');
  assert.doesNotMatch(read('miniprogram/pages/record/record.js'),/chooseMessageFile/);
  const markup=read('miniprogram/pages/record/record.wxml');
  assert.equal((markup.match(/bindtap="chooseImage"/g)||[]).length,1);
  assert.match(markup,/从手机相册添加/);assert.doesNotMatch(markup,/聊天文件/);
});

test('web uses a multi-file device picker, without camera capture or chat selection',()=>{
  const code=read('app/components/EntryComposer.tsx');
  assert.match(code,/从本机选择图片、GIF 或视频/);
  assert.match(code,/type="file" multiple accept=\{MEDIA_ACCEPT\}/);
  assert.doesNotMatch(code,/capture=|chooseMessageFile/);
});
