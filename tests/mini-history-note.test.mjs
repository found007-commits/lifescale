import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const read = file => readFileSync(new URL('../miniprogram/' + file, import.meta.url), 'utf8');
const copy = '人生的每一步，未必都完美；记录的每一笔，也是如此。偶尔写错，也成了自己的历史。留下或删去，都由自己决定。';

test('journal shows the approved reflection and explicit deletion help in all languages', () => {
  const wxml = read('pages/history/history.wxml');
  assert.ok(wxml.includes(copy));
  assert.ok(wxml.indexOf('history-reflection') < wxml.indexOf('wx:if="{{loading}}"'));
  const hint = '所有记录默认仅自己可见。长按记录文字或卡片，可删除这条记录。';
  assert.ok(wxml.includes(hint));
  const translate = require('../miniprogram/utils/locale-copy.js');
  for (const text of [copy, hint]) {
    assert.equal(translate(text,'zh'),text);
    assert.notEqual(translate(text,'zh-TW'),text);
    assert.doesNotMatch(translate(text,'en'),/[\u4e00-\u9fff]/);
  }
  assert.match(wxml,/bindlongpress="removeEntry"/);
  assert.match(wxml,/catchlongpress="previewPhoto"/);
  assert.match(wxml,/catchtap="shareEntry"/);
});

test('deletion still requires confirmation and declining leaves records untouched', async () => {
  let page, modal, deleted=0;
  vm.runInNewContext(read('pages/history/history.js'), {
    require:path=>path.endsWith('localized-page')?definition=>{page=definition;}:path.endsWith('supabase')?{deleteEntry:async()=>{deleted++;}}:{},
    wx:{showModal:options=>{modal=options;},showLoading(){},hideLoading(){},showToast(){}},
  });
  page.setData=function(values){Object.assign(this.data,values);};
  page.setData({entries:[{id:'synthetic-only',content:'Test record'}]});
  page.removeEntry({currentTarget:{dataset:{index:0}}});
  assert.equal(deleted,0);assert.match(modal.content,/永久删除，无法恢复/);
  await modal.success({confirm:false});assert.equal(deleted,0);assert.equal(page.data.entries.length,1);
  await modal.success({confirm:true});assert.equal(deleted,1);assert.equal(page.data.entries.length,0);
});
