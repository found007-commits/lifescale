import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../miniprogram/'+path,import.meta.url),'utf8');
function harness(updateProfile) {
  let page;const notices=[];
  vm.runInNewContext(read('pages/dashboard/dashboard.js'),{
    require:path=>path.endsWith('localized-page')?definition=>{page=definition;}:path.endsWith('supabase')?{updateProfile}:require('../miniprogram/utils/'+path.split('/').pop()+'.js'),
    wx:{showToast:value=>notices.push(value)},
  });
  page.setData=values=>Object.assign(page.data,values);
  page.data.profile={id:'synthetic',display_mode:'gentle',target_age:80};
  return {page,notices};
}
const mode=value=>({currentTarget:{dataset:{mode:value}}});
test('mode switches immediately, locks duplicate writes and persists only display preference',async()=>{
  let resolve;const writes=[];
  const {page}=harness((...args)=>{writes.push(args);return new Promise(r=>{resolve=r;});});
  const pending=page.setMode(mode('clear'));
  assert.equal(page.data.profile.display_mode,'clear');assert.equal(page.data.switching,true);
  await page.setMode(mode('gentle'));assert.equal(writes.length,1);
  assert.equal(JSON.stringify(writes),JSON.stringify([['synthetic',{display_mode:'clear'}]]));
  resolve({...page.data.profile});await pending;assert.equal(page.data.switching,false);
  await page.setMode(mode('clear'));await page.setMode(mode('invalid'));assert.equal(writes.length,1);
});
test('failed mode save restores original view and reports failure',async()=>{
  const {page,notices}=harness(async()=>{throw Error('Synthetic save failure');});
  await page.setMode(mode('clear'));
  assert.equal(page.data.profile.display_mode,'gentle');assert.equal(page.data.profile.target_age,80);
  assert.equal(page.data.switching,false);assert.equal(notices[0].title,'Synthetic save failure');
});
test('gentle and clear modes have different layouts; truthful target labels and bonus state remain',()=>{
  const wxml=read('pages/dashboard/dashboard.wxml'),css=read('pages/dashboard/dashboard.wxss');
  assert.match(wxml,/wx:if="\{\{profile.display_mode !== 'clear'\}\}" class="gentle-view"/);
  assert.match(wxml,/wx:else class="clear-view"/);
  const clear=wxml.slice(wxml.indexOf('class="clear-view"'),wxml.indexOf('class="mode-disclaimer"'));
  for(const field of ['displayDaysText','progressText','livedDaysText','weeksText'])assert.ok(clear.includes(field));
  assert.match(clear,/metrics.isBonus \? '已超过设定目标'/);
  assert.match(clear,/wx:if="\{\{!metrics.isBonus\}\}"/);
  assert.match(wxml,/并非寿命预测/);assert.doesNotMatch(clear,/死亡|仅剩|寿命倒计时/);
  assert.match(css,/\.life-gentle \{ background: #e3ece3/);
  assert.match(css,/\.life-clear \{ background: #202923/);
  assert.match(css,/\.today-title text \{ white-space: normal/);
});
test('new mode copy is translated in English and Traditional Chinese',()=>{
  const t=require('../miniprogram/utils/locale-copy.js');
  for(const copy of ['慢慢来，认真过好今天。','目标之外，生活仍在继续。','已超过设定目标','距设定目标还剩','目标已走过，今天仍由你安排。','今天，你想留下什么？','设定目标进度','按你设定的目标年龄计算，并非寿命预测。']) {
    assert.doesNotMatch(t(copy,'en'),/[\u4e00-\u9fff]/);assert.ok(t(copy,'zh-TW').length);
  }
});
test('clear mode uses the confirmed recording prompt, not the retired slogan',()=>{
  const wxml=read('pages/dashboard/dashboard.wxml');
  assert.match(wxml,/今天，你想留下什么？/);
  assert.doesNotMatch(wxml,/时间不会暂停|今天，留给什么/);
  const t=require('../miniprogram/utils/locale-copy.js');
  assert.equal(t('今天，你想留下什么？','en'),'What would you like to capture today?');
  assert.equal(t('今天，你想留下什么？','zh-TW'),'今天，你想留下什麼？');
});
test('dashboard template expressions have valid JavaScript syntax',()=>{
  for(const [,expression] of read('pages/dashboard/dashboard.wxml').matchAll(/\{\{([\s\S]*?)\}\}/g)) {
    assert.doesNotThrow(()=>new vm.Script('('+expression+')'),expression);
  }
});
