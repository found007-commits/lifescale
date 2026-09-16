import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function fixture(){
  let page,confirm=false,fail=false,resolveSave;const writes=[],dialogs=[];
  vm.runInNewContext(readFileSync(new URL('../miniprogram/pages/entry/entry.js',import.meta.url),'utf8'),{
    wx:{showModal:o=>{dialogs.push(o);o.success({confirm});},showToast(){}},
    require:path=>path.endsWith('localized-page')?value=>{page=value;}:path.endsWith('supabase')?{editEntryOnce:async(...args)=>{writes.push(args);if(fail)throw Error('network');await new Promise(resolve=>{resolveSave=resolve;});return{id:'entry',content:args[1].content,mood:'calm',category:'daily',edit_count:1};}}:require('../miniprogram/utils/'+path.split('/').pop()+'.js'),
  });
  page.setData=values=>Object.assign(page.data,values);page.entryId='entry';page.setData({locale:'zh',entry:{id:'entry',content:'Original',mood:'calm',category:'daily',edit_count:0},media:[]});
  return{page,writes,dialogs,confirm:value=>confirm=value,fail:value=>fail=value,complete:()=>resolveSave()};
}
test('cancel and unchanged edit never write; blank content is rejected before confirmation',async()=>{
  const f=fixture(),p=f.page;p.startEdit();await p.saveEdit();assert.equal(f.writes.length,0);assert.equal(f.dialogs.length,0);
  p.startEdit();p.onEditContent({detail:{value:'New'}});await p.saveEdit();assert.equal(f.dialogs.length,1);assert.equal(f.writes.length,0);assert.equal(p.data.editSaving,false);
  p.onEditContent({detail:{value:'  '}});await p.saveEdit();assert.equal(f.dialogs.length,1);assert.ok(p.data.editError);
});
test('one edit confirms each attempt; failed save keeps text and retry key, duplicate clicks cannot write twice',async()=>{
  const f=fixture(),p=f.page;f.confirm(true);f.fail(true);p.startEdit();p.onEditContent({detail:{value:'New'}});await p.saveEdit();
  assert.equal(p.data.editContent,'New');assert.equal(p.data.editSaving,false);assert.equal(p.data.entry.edit_count,0);
  f.fail(false);const save=p.saveEdit();await Promise.resolve();await p.saveEdit();f.complete();await save;
  assert.equal(f.writes.length,2);assert.equal(f.writes[0][2],f.writes[1][2]);assert.equal(f.dialogs.length,2);assert.equal(p.data.editAllowed,false);assert.equal(p.data.entry.content,'New');
  p.startEdit();assert.equal(p.data.editing,false);
  assert.ok(f.dialogs.every(d=>d.content.includes('每条记录仅可修改一次')));
});
