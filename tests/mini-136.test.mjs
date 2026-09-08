import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../miniprogram/'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
test('four short tabs match native routes and live localization in all languages',async()=>{
  const tabs=JSON.parse(read('app.json')).tabBar.list;
  assert.deepEqual(tabs.map(t=>t.text),['历史','今天','小回顾','设置']);
  assert.deepEqual(tabs.map(t=>t.pagePath),['history','dashboard','report','settings'].map(p=>'pages/'+p+'/'+p));
  const translate=require('../miniprogram/utils/locale-copy.js');
  for(const locale of ['zh','zh-TW','en']) {
    let page;const labels=[];
    const app={globalData:{locale}};
    // Load the exported page wrapper without touching auth or private records.
    const context={module:{exports:{}},Page:d=>{page=d;},getApp:()=>app,getCurrentPages:()=>[],require:p=>p.endsWith('app-share')?d=>d:p.endsWith('share-card')?{formatDate:()=>''}:translate,wx:{setNavigationBarTitle(){},setTabBarItem({index,text}){labels[index]=text;}}};
    vm.runInNewContext(read('utils/localized-page.js'),context);
    context.module.exports({data:{}});page.setData=data=>Object.assign(page.data,data);await page.onShow();
    assert.deepEqual(labels,tabs.map(tab=>translate(tab.text,locale)));
    if(locale==='en')assert.deepEqual(labels,['History','Today','Review','Settings']);
    for(const label of labels)assert.ok(label.length<=8);
  }
});
test('settings quotas are separate block lines and all setup rules match seven-change policy',()=>{
  const settings=read('pages/settings/settings.wxml');
  assert.match(settings,/policy.remaining}} \/ 7/);
  assert.match(settings,/policy.firstYearRemaining}} \/ 3/);
  assert.match(read('pages/settings/settings.wxss'),/\.profile-card > \.field-help \{ display: block/);
  const onboarding=read('pages/onboarding/onboarding.wxml');
  assert.match(onboarding,/累计最多 7 次/);
  assert.doesNotMatch(onboarding+settings,/累计最多 3 次|累计 3 次调整/);
  const paths=['pages/index/index.wxml','pages/legal/legal.js','utils/locale-dictionary.json'];
  for(const path of paths)assert.doesNotMatch(read(path),/累计最多 3 次|3 adjustments in total|up to 3 times/);
  for(const path of ['app/components/AuthPanel.tsx','app/components/Onboarding.tsx','app/components/CoreTargetEditor.tsx','app/privacy/page.tsx','app/terms/page.tsx','app/account-deletion/page.tsx'])
    assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/累计最多 3 次|3 adjustments in total|up to 3 times/);
});
