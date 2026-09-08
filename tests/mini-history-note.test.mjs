import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const read = file => readFileSync(new URL('../miniprogram/' + file, import.meta.url), 'utf8');
const translate = require('../miniprogram/utils/locale-copy.js');
const copy = '人生的每一步，未必都完美；记录的每一笔，也是如此。偶尔写错，也成了自己的历史。留下或删去，都由自己决定。';
const warning = '确认删除后，文字和照片会永久删除，无法恢复。';

test('both journal surfaces expose a left delete button without requiring long press', () => {
  const history = read('pages/history/history.wxml');
  // The full reflection is reserved for the confirmation, not repeated above every visit.
  assert.ok(!history.includes(copy));
  assert.ok(read('utils/entry-actions.js').includes(copy));
  const hint = '这些记录，仅自己可见。';
  assert.ok(history.includes(hint));
  for (const text of [copy, hint, warning]) {
    assert.equal(translate(text,'zh'),text);
    assert.notEqual(translate(text,'zh-TW'),text);
    assert.doesNotMatch(translate(text,'en'),/[\u4e00-\u9fff]/);
  }
  for (const name of ['history', 'dashboard']) {
    const wxml = read(`pages/${name}/${name}.wxml`);
    assert.match(wxml, /class="entry-delete"[^>]+catchtap="removeEntry"/);
    assert.ok(wxml.indexOf('class="entry-delete"') < wxml.indexOf('class="entry-share"'));
    assert.doesNotMatch(wxml, /bindlongpress="removeEntry"/);
    assert.match(wxml, /catchtap="shareEntry"/);
    assert.match(read(`pages/${name}/${name}.js`), /confirmDeleteEntry\(this,/);
  }
  assert.match(history,/catchlongpress="previewPhoto"/);
});

function fixture({ locale = 'zh', failure = false, listKey = 'entries' } = {}) {
  const state = { deleted: [], modals: [], toasts: [], events: [] };
  const moduleStub = { exports: {} };
  vm.runInNewContext(read('utils/entry-actions.js'), {
    module: moduleStub,
    require: path => path === './locale-copy' ? translate : {
      deleteEntry: async entry => {
        state.deleted.push(entry.id);
        if (failure) throw new Error('Synthetic failure');
      },
    },
    wx: {
      showModal: options => state.modals.push(options),
      showLoading: () => state.events.push('loading'),
      hideLoading: () => state.events.push('hidden'),
      showToast: options => { state.toasts.push(options); state.events.push('toast'); },
    },
  });
  const entry = { id: 'synthetic-only', content: 'Test record' };
  const page = {
    data: { locale, [listKey]: [entry] },
    setData(values) { Object.assign(this.data, values); },
  };
  return { state, entry, page, run: () => moduleStub.exports.confirmDeleteEntry(page, entry, listKey) };
}

for (const locale of ['zh', 'zh-TW', 'en']) {
  test(`deletion requires explicit confirmation and repeats the approved reminder (${locale})`, async () => {
    const f = fixture({ locale });
    const pending = f.run();
    assert.equal(f.state.deleted.length, 0);
    assert.equal(f.state.modals[0].content, translate(copy, locale) + '\n\n' + translate(warning, locale));
    f.state.modals[0].success({ confirm: false });
    await pending;
    assert.equal(f.state.deleted.length, 0);
    assert.equal(f.page.data.entries.length, 1);
    assert.equal(f.page.deletingEntry, false);
    const confirmed = f.run();
    f.state.modals[1].success({ confirm: true });
    await confirmed;
    assert.deepEqual(f.state.deleted, ['synthetic-only']);
    assert.equal(f.page.data.entries.length, 0);
    assert.deepEqual(f.state.events, ['loading', 'hidden', 'toast']);
  });
}

test('duplicate taps cannot open a second modal and deletion follows ID if cards reorder', async () => {
  const f = fixture({ listKey: 'recentEntries' });
  const pending = f.run();
  await f.run();
  assert.equal(f.state.modals.length, 1);
  f.page.data.recentEntries.unshift({ id: 'other-synthetic' });
  f.state.modals[0].success({ confirm: true });
  await pending;
  assert.deepEqual(Array.from(f.page.data.recentEntries, entry => entry.id), ['other-synthetic']);
  assert.equal(f.page.deletingEntry, false);
});

test('failed deletion retains the card and allows retry', async () => {
  const f = fixture({ failure: true });
  const pending = f.run();
  f.state.modals[0].success({ confirm: true });
  await pending;
  assert.equal(f.page.data.entries.length, 1);
  assert.equal(f.page.deletingEntry, false);
  assert.equal(f.state.toasts[0].icon, 'none');
  assert.deepEqual(f.state.events, ['loading', 'hidden', 'toast']);
});

test('failed dialog does not delete and clears the busy flag', async () => {
  const f = fixture();
  const pending = f.run();
  f.state.modals[0].fail();
  await pending;
  assert.equal(f.state.deleted.length, 0);
  assert.equal(f.page.deletingEntry, false);
});
