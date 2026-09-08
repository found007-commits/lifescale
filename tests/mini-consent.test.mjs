import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const source = name => readFileSync(new URL('../miniprogram/pages/auth/auth.' + name, import.meta.url), 'utf8');
function setup() {
  let page;
  const calls = { send:0, verify:0, profile:0, destinations:[] };
  const sandbox = { require(path) {
    if (path.endsWith('localized-page')) return definition => { page = definition; };
    if (path.endsWith('locale-copy')) return require('../miniprogram/utils/locale-copy.js');
    return {
      sendOtp: async()=>{calls.send++;},
      verifyOtp:async()=>{calls.verify++;return {user:{id:'qa-only'}};},
      getProfile:async()=>{calls.profile++;return {onboarding_completed:false};},
    };
  }, setInterval:()=>1,clearInterval(){}, wx:{showToast(){},reLaunch:o=>calls.destinations.push(o.url),redirectTo:o=>calls.destinations.push(o.url)} };
  vm.runInNewContext(source('js'),sandbox);
  page.setData=function(values){Object.assign(this.data,values);};
  page.setData({email:'qa@example.invalid',code:'123456',locale:'zh'});
  return {page,calls};
}
test('mini login defaults to no consent and blocks every auth request',async()=>{
  const {page,calls}=setup();
  assert.equal(page.data.agreed,false);
  await page.sendCode();await page.verifyCode();
  assert.equal(calls.send,0);assert.equal(calls.verify,0);assert.equal(calls.profile,0);
  assert.match(page.data.error,/自行选择/);
  page.browseWithoutLogin();assert.deepEqual(calls.destinations,['/pages/index/index']);
  assert.equal(page.data.agreed,false);
});
test('only active opt-in enables auth; withdrawing blocks resend and verify',async()=>{
  const {page,calls}=setup();
  page.onConsentChange({detail:{value:['agree']}});
  await page.sendCode();assert.equal(calls.send,1);
  page.onConsentChange({detail:{value:[]}});page.setData({seconds:0});
  await page.sendCode();await page.verifyCode();
  assert.equal(calls.send,1);assert.equal(calls.verify,0);
  page.onConsentChange({detail:{value:['agree']}});await page.verifyCode();
  assert.equal(calls.verify,1);assert.equal(calls.profile,1);
  assert.deepEqual(calls.destinations,['/pages/history/history']);
  assert.equal(setup().page.data.agreed,false); // consent isn't silently persisted
});
test('legal links are separate from checkbox and all auth buttons require opt-in',()=>{
  const wxml=source('wxml');
  assert.match(wxml,/checked="\{\{agreed\}\}"/);
  assert.doesNotMatch(wxml,/继续即表示|默认同意|checked="true"/);
  assert.doesNotMatch(wxml.match(/<label[\s\S]*?<\/label>/)[0],/<navigator/);
  for(const name of ['sendCode','verifyCode']){
    const buttons=wxml.split('\n').filter(line=>line.includes('<button') && line.includes('bindtap="'+name+'"'));
    assert.ok(buttons.length > 0);
    for(const button of buttons) assert.match(button,/disabled="[^"]*!agreed/);
  }
  assert.match(wxml,/type=terms/);assert.match(wxml,/type=privacy/);assert.match(wxml,/browseWithoutLogin/);
  const t=require('../miniprogram/utils/locale-copy.js');
  assert.match(t('我已阅读并同意','en'),/read and agree/);
  assert.match(t('我已阅读并同意','zh-TW'),/閱讀/);
});
