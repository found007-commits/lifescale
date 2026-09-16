import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=name=>readFileSync(new URL('../miniprogram/'+name,import.meta.url),'utf8');
const dict=require('../miniprogram/utils/locale-dictionary.json');
const PRIVACY='需要同意隐私保护指引后才能选择照片或视频。';

// A record page whose platform privacy APIs are scripted. The authority on whether a blocked
// interface runs is WeChat, so the scripted resolve() resolves or rejects requirePrivacyAuthorize
// exactly the way the platform does.
function record(options={}){
  let page, media=0, authorize=0;
  let pendingAuthorize=null;
  const listeners=[];
  const routes=[];
  const answered=[];
  const wx={
    chooseMedia:o=>{media++; if(options.media)options.media(o); else o.fail({errMsg:'chooseMedia:fail cancel'});},
    getFileSystemManager:()=>({unlink(){}}),
    navigateTo:o=>{routes.push(o.url);},
    openPrivacyContract:o=>{routes.push('openPrivacyContract'); if(options.contractFails&&o.fail)o.fail({});},
    onNeedPrivacyAuthorization:fn=>{listeners.push(fn);},
    offNeedPrivacyAuthorization:fn=>{const i=listeners.indexOf(fn); if(i>=0)listeners.splice(i,1);},
  };
  if(options.noAuthorizeApi!==true) wx.requirePrivacyAuthorize=o=>{
    authorize++;
    if(options.granted===true)o.success({}); else pendingAuthorize=o;
  };
  vm.runInNewContext(read('pages/record/record.js'),{
    getApp:()=>({globalData:{}}), wx,
    require:p=>p.endsWith('localized-page')?d=>{page=d;}:p.endsWith('supabase')?{}:require('../miniprogram/utils/'+p.split('/').pop()+'.js'),
  });
  page.setData=values=>Object.assign(page.data,values);
  page.onLoad();
  // Raise the platform event the way WeChat does, then translate the page's answer back into
  // the outcome the platform would apply to the blocked interface.
  const raise=()=>{
    assert.ok(listeners.length,'page must register onNeedPrivacyAuthorization');
    return listeners[0]((answer)=>{
      // The answer is built inside the sandbox, so copy it into the host realm before comparing.
      answered.push({...(answer||{})});
      const waiter=pendingAuthorize; pendingAuthorize=null;
      if(answer.event==='agree'){ if(waiter)waiter.success({}); }
      else if(waiter)waiter.fail({errno:104,errMsg:'requirePrivacyAuthorize:fail user deny'});
    });
  };
  return {page, raise, answered, routes, listeners,
    media:()=>media, authorize:()=>authorize, pending:()=>!!pendingAuthorize};
}

test('the album picker is gated by the privacy agreement and decline never opens it',async()=>{
  const r=record();
  const running=r.page.chooseImage();
  await Promise.resolve();
  assert.equal(r.authorize(),1,'privacy must be requested before the album opens');
  assert.equal(r.media(),0,'the album must not open before the user answers');
  r.raise(); assert.equal(r.page.data.privacyOpen,true);
  r.page.onPrivacyDecline();
  await running;
  assert.equal(r.page.data.privacyOpen,false);
  assert.equal(r.media(),0);
  assert.equal(r.page.data.error,PRIVACY);
  assert.doesNotMatch(r.page.data.error,/重试/,'a declined agreement is not a retryable failure');
});

test('agreeing answers the platform with the agreement button and then opens the album',async()=>{
  const r=record({granted:false,media:o=>o.fail({errMsg:'chooseMedia:fail cancel'})});
  const running=r.page.chooseImage();
  await Promise.resolve();
  r.raise();
  r.page.onPrivacyAgree();
  await running;
  assert.deepEqual(r.answered,[{buttonId:'privacy-agree',event:'agree'}]);
  assert.equal(r.media(),1);
  assert.equal(r.page.data.privacyOpen,false);
  assert.equal(r.page.data.error,'');
});

test('the agree button is a real platform agreement button keyed to the resolved buttonId',async()=>{
  const markup=read('pages/record/record.wxml');
  assert.match(markup,/id="privacy-agree"/);
  assert.match(markup,/open-type="agreePrivacyAuthorization"/);
  assert.match(markup,/bindagreeprivacyauthorization="onPrivacyAgree"/);
  const code=read('pages/record/record.js');
  assert.match(code,/buttonId: "privacy-agree", event: "agree"/);
  assert.match(markup,/\{\{i18n\.t\(error, locale\)\}\}/,'error copy must stay translatable');
  assert.ok(dict[PRIVACY],'the privacy message must be translatable');
});

test('a privacy errno from the picker is not reported as a retryable failure',async()=>{
  const r=record({granted:true,media:o=>o.fail({errno:112,errMsg:'chooseMedia:fail api scope is not declared in the privacy agreement'})});
  await r.page.chooseImage();
  assert.equal(r.page.data.error,PRIVACY);
  assert.equal(r.page.data.processing,false);
  const declined=record({granted:true,media:o=>o.fail({errno:104,errMsg:'chooseMedia:fail user deny'})});
  await declined.page.chooseImage();
  assert.equal(declined.page.data.error,PRIVACY);
});

test('genuine picker failures keep the original retry copy',async()=>{
  const r=record({granted:true,media:o=>o.fail({errMsg:'chooseMedia:fail internal error'})});
  await r.page.chooseImage();
  assert.equal(r.page.data.error,'选择图片失败，请重试。');
  assert.ok(dict['选择图片失败，请重试。'],'the retry copy must be translatable too');
});

test('leaving the page answers disagree and unregisters so nothing hangs',async()=>{
  const r=record();
  const running=r.page.chooseImage();
  await Promise.resolve();
  r.raise();
  assert.equal(r.page.data.privacyOpen,true);
  r.page.onUnload();
  await running;
  assert.deepEqual(r.answered,[{event:'disagree'}]);
  assert.equal(r.listeners.length,0,'the page must stop listening once it is gone');
  assert.equal(r.media(),0);
});

test('a base library without requirePrivacyAuthorize still opens the album',async()=>{
  const r=record({noAuthorizeApi:true,media:o=>o.fail({errMsg:'chooseMedia:fail cancel'})});
  await r.page.chooseImage();
  assert.equal(r.media(),1);
  assert.equal(r.page.data.error,'');
});

test('the privacy contract opens the platform page and falls back to the local policy',async()=>{
  const platform=record({contractFails:false});
  platform.page.onPrivacyContract();
  assert.deepEqual(platform.routes,['openPrivacyContract']);
  const fallback=record({contractFails:true});
  fallback.page.onPrivacyContract();
  assert.deepEqual(fallback.routes,['openPrivacyContract','/pages/legal/legal?type=privacy']);
});
