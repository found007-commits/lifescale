import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const read = file => readFileSync(new URL('../miniprogram/' + file, import.meta.url), 'utf8');
function pageHarness(name) {
  let page; const writes = [], routes = [];
  const api = { restoreSession: () => ({ user: { id: 'synthetic-only' } }), createEntry: async input => writes.push(input) };
  vm.runInNewContext(read(`pages/${name}/${name}.js`), {
    require: path => path.endsWith('localized-page') ? definition => { page = definition; } : path.endsWith('supabase') ? api : require('../miniprogram/utils/' + path.split('/').pop() + '.js'),
    wx: { showToast() {}, navigateTo: options => routes.push(options.url) }, setTimeout() {},
  });
  page.setData = values => Object.assign(page.data, values);
  return { page, writes, routes };
}

test('writing comes before optional prompts and uses compact metadata selectors', () => {
  const wxml = read('pages/record/record.wxml');
  assert.ok(wxml.indexOf('<textarea') < wxml.indexOf('bindtap="toggleInspiration"'));
  assert.match(wxml, /wx:if="\{\{inspirationOpen\}\}"/);
  assert.match(wxml, /range="\{\{moodPickerLabels\}\}"/);
  assert.match(wxml, /range="\{\{categoryPickerLabels\}\}"/);
  assert.doesNotMatch(wxml, /bindtap="chooseMood"|bindtap="chooseCategory"/);
  for (const action of ['chooseImage', 'saveEntry']) assert.ok(wxml.includes(`bindtap="${action}"`));
});

test('optional inspiration never changes a draft or requires a choice', async () => {
  const { page, writes } = pageHarness('record'); page.onLoad();
  assert.equal(page.data.inspirationOpen, false);
  page.onContentInput({ detail: { value: 'My own words' } });
  page.toggleInspiration(); page.chooseTopic({ currentTarget: { dataset: { index: 1 } } });
  const prompt = page.data.prompt; page.toggleInspiration();
  assert.equal(page.data.content, 'My own words'); assert.equal(page.data.prompt, prompt);
  assert.equal(page.data.inspirationOpen, false);
  await page.saveEntry();
  assert.equal(writes.length, 1); assert.equal(writes[0].content, 'My own words');
  assert.equal(writes[0].mood, 'calm'); assert.equal(writes[0].category, 'daily');
});

test('compact selectors retain every original value, validate indices and lock after saving', async () => {
  const { page, writes } = pageHarness('record'); page.onLoad();
  assert.equal(page.data.moods.length, 7); assert.equal(page.data.categories.length, 8);
  for (let i = 0; i < page.data.moods.length; i++) {
    page.onMoodChange({ detail: { value: String(i) } }); assert.equal(page.data.mood, page.data.moods[i].value);
  }
  for (let i = 0; i < page.data.categories.length; i++) {
    page.onCategoryChange({ detail: { value: String(i) } }); assert.equal(page.data.category, page.data.categories[i].value);
  }
  for (const value of [-1, 100, 'bad', 1.5]) {
    page.onMoodChange({ detail: { value } }); page.onCategoryChange({ detail: { value } });
    assert.equal(page.data.mood, 'hopeful'); assert.equal(page.data.category, 'other');
  }
  page.onContentInput({ detail: { value: 'A real choice, synthetic record' } }); await page.saveEntry();
  assert.equal(writes[0].mood, 'hopeful'); assert.equal(writes[0].category, 'other');
  page.onMoodChange({ detail: { value: 0 } }); page.onCategoryChange({ detail: { value: 0 } });
  assert.equal(page.data.moodIndex, 6); assert.equal(page.data.categoryIndex, 7);
});

test('picker labels follow locale updates without changing selected values', async () => {
  const moduleStub = { exports: {} }; let page;
  const app = { globalData: { locale: 'en' } };
  vm.runInNewContext(read('utils/localized-page.js'), {
    module: moduleStub, Page: definition => { page = definition; }, getApp: () => app, getCurrentPages: () => [],
    require: path => path.endsWith('app-share') ? definition => definition : require('../miniprogram/utils/' + path.split('/').pop() + '.js'),
    wx: { setNavigationBarTitle() {}, setTabBarItem() {} },
  });
  const record = pageHarness('record').page;
  record.onMoodChange({ detail: { value: 5 } });
  moduleStub.exports({ data: record.data });
  page.setData = values => Object.assign(page.data, values);
  for (const locale of ['en', 'zh-TW', 'zh']) {
    app.globalData.locale = locale; await page.onShow();
    assert.equal(page.data.mood, 'anxious'); assert.equal(page.data.moodIndex, 5);
    assert.equal(page.data.moodPickerLabels.length, 7); assert.equal(page.data.categoryPickerLabels.length, 8);
    if (locale === 'en') assert.doesNotMatch(page.data.moodPickerLabels.join(''), /[\u4e00-\u9fff]/);
  }
});

test('home brings recording forward without hiding modes, deleting metrics or changing routes', () => {
  const wxml = read('pages/dashboard/dashboard.wxml');
  assert.ok(wxml.indexOf('class="today-button') < wxml.indexOf('class="life-card '));
  assert.match(wxml, /wx:if="\{\{detailsOpen\}\}" class="metric-grid"/);
  for (const key of ['livedDaysText', 'progressText', 'weeksText', 'checkinCount']) assert.ok(wxml.includes(key));
  for (const action of ['setMode', 'recordToday', 'removeEntry', 'shareEntry']) assert.ok(wxml.includes(`"${action}"`));
  const { page, routes } = pageHarness('dashboard');
  assert.equal(page.data.detailsOpen, false); page.toggleDetails(); assert.equal(page.data.detailsOpen, true);
  page.recordToday(); assert.deepEqual(routes, ['/pages/record/record']);
  assert.ok(wxml.includes('journeyMessage'));
});

test('share adjustments are grouped inside the collapsed settings, not removed', () => {
  const wxml = read('pages/share/share.wxml');
  const settings = wxml.indexOf('<view wx:if="{{settingsOpen}}"');
  const preview = wxml.indexOf('<scroll-view');
  for (const action of ['editSelection', 'chooseLayout', 'chooseBackground', 'changeShareOption']) {
    const position = wxml.indexOf(`"${action}"`); assert.ok(position > settings && position < preview);
  }
  for (const action of ['shareImage', 'saveImage']) assert.ok(wxml.includes(`bindtap="${action}"`));
  assert.ok(wxml.includes('原记录仍仅自己可见'));
  assert.doesNotMatch(read('pages/history/history.wxml'), /history-reflection|长按记录文字/);
  assert.match(read('utils/entry-actions.js'), /偶尔写错，也成了自己的历史/);
});
