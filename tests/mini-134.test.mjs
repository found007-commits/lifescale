import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../miniprogram/' + path, import.meta.url), 'utf8');
const { buildShareCopy, normalizeNickname } = require('../miniprogram/utils/share-selection.js');
const { planCard, drawCard, MAX_HEIGHT } = require('../miniprogram/utils/share-card.js');
const t = require('../miniprogram/utils/locale-copy.js');
const original = Object.freeze({ content: 'Synthetic words', entry_date: '2026-09-08', mood: 'calm', category: 'daily', email: 'PRIVATE_EMAIL', user_id: 'PRIVATE_ID', display_name: 'PRIVATE_NAME' });

function harness({ nickname = 'River', layout = 'separate', locale = 'en' } = {}) {
  let page;
  const painted = [], removed = [], sent = [];
  const ctx = { measureText: text => ({ width: Array.from(text).length * 17 }), fillRect() {}, drawImage() {}, fillText: (text, x, y) => painted.push({ text, x, y }) };
  const canvas = { getContext: () => ctx };
  const wx = {
    getFileSystemManager: () => ({ unlink: ({ filePath }) => removed.push(filePath) }),
    canvasToTempFilePath: options => options.success({ tempFilePath: `synthetic-${removed.length}-${painted.length}.png` }),
    showShareImageMenu: options => { sent.push(options); options.success({}); },
    saveImageToPhotosAlbum: options => { sent.push(options); options.success({}); },
    showToast() {}, showModal() {},
  };
  vm.runInNewContext(read('pages/share/share.js'), {
    getApp: () => ({ globalData: { profile: { display_name: nickname }, user: { email: 'PRIVATE_EMAIL' } } }),
    wx, setTimeout: () => 1, clearTimeout() {},
    require: path => path.endsWith('localized-page') ? definition => { page = definition; } : require('../miniprogram/utils/' + path.split('/').pop() + '.js'),
  });
  page.setData = values => Object.assign(page.data, values);
  page.getOpenerEventChannel = () => ({ on: (_event, callback) => callback({ entry: original, locale }) });
  page.onLoad(); page.canvas = canvas; page.photos = layout === 'overlay' ? [{ width: 300, height: 400 }] : [];
  page.setData({ busy: false, layout, locale });
  return { page, wx, painted, removed, sent, change: (key, value) => page.changeShareOption({ currentTarget: { dataset: { option: key } }, detail: { value } }) };
}

test('sharing keeps old metadata defaults but never signs without an explicit choice', () => {
  const copy = buildShareCopy(original, original.content, []);
  assert.equal(copy.entry.entry_date, original.entry_date);
  assert.equal(copy.entry.moodLabel, '平静');
  assert.equal(copy.entry.signature, undefined);
  assert.doesNotMatch(JSON.stringify(copy), /PRIVATE/);
  const privateCopy = buildShareCopy(original, 'Selected text', [], { showDate: false, showMood: false, showSignature: false, nickname: 'River' });
  assert.equal(privateCopy.entry.entry_date, '');
  assert.equal(privateCopy.entry.moodLabel, ''); assert.equal(privateCopy.entry.categoryLabel, '');
  assert.equal(privateCopy.entry.signature, undefined);
  assert.equal(original.content, 'Synthetic words');
});

test('empty nickname has no email fallback and every share starts unsigned', async () => {
  const f = harness({ nickname: '' });
  await f.change('showSignature', true);
  assert.equal(f.page.data.showSignature, false);
  assert.equal(f.page.selection.entry.signature, undefined);
  assert.equal(harness().page.data.showSignature, false);
  assert.equal(normalizeNickname('  River\n\u202eWest  '), 'River  West');
  assert.equal(Array.from(normalizeNickname('🌿'.repeat(100))).length, 80);
});

for (const layout of ['separate', 'overlay']) {
  test(`actual ${layout} export reflects all metadata switches and preserves text selections`, async () => {
    const f = harness({ layout });
    await f.page.generate();
    assert.ok(f.painted.some(item => item.text === '08/09/2026'));
    assert.ok(f.painted.some(item => item.text === 'Calm · Daily life'));
    assert.ok(!f.painted.some(item => item.text === 'River'));
    f.painted.length = 0;
    await f.change('showDate', false); await f.change('showMood', false);
    f.painted.length = 0;
    await f.change('showSignature', true);
    assert.ok(f.painted.some(item => item.text === 'River'));
    assert.ok(!f.painted.some(item => /08\/09\/2026|Calm|Daily life|PRIVATE/.test(item.text)));
    assert.ok(f.painted.some(item => item.text === 'Synthetic words'));
    f.page.editSelection(); f.page.onShareText({ detail: { value: 'Edited copy' } });
    await f.page.applySelection();
    assert.equal(f.page.selection.entry.entry_date, ''); assert.equal(f.page.selection.entry.signature, 'River');
    assert.equal(f.page.selection.entry.content, 'Edited copy'); assert.equal(original.content, 'Synthetic words');
    f.painted.length = 0; await f.change('showSignature', false);
    assert.ok(!f.painted.some(item => item.text === 'River'));
    await f.page.shareImage(); await f.page.saveImage();
    assert.equal(f.sent[0].path, f.page.data.cards[0].path); assert.equal(f.sent[1].filePath, f.page.data.cards[0].path);
    assert.equal(f.sent[0].entrancePath, 'pages/index/index');
  });
}

test('regeneration clears stale images immediately, disables sending and fails closed', async () => {
  const f = harness(); await f.page.generate();
  const old = f.page.data.cards[0].path;
  let pending;
  f.wx.canvasToTempFilePath = options => { pending = options; };
  const generation = f.change('showDate', false);
  assert.equal(f.page.data.cards.length, 0); assert.equal(f.page.data.busy, true);
  assert.ok(f.removed.includes(old));
  await f.page.shareImage(); await f.page.saveImage();
  assert.equal(f.sent.length, 0);
  await f.change('showSignature', true); assert.equal(f.page.data.showSignature, false);
  pending.fail({ errMsg: 'synthetic canvas failure' }); await generation;
  assert.equal(f.page.data.busy, false); assert.equal(f.page.data.cards.length, 0); assert.ok(f.page.data.error);
});

test('sending prevents regeneration and repeated sends until native menu completes', async () => {
  const f = harness(); await f.page.generate();
  let menu;
  f.wx.showShareImageMenu = options => { menu = options; };
  const sharing = f.page.shareImage();
  assert.equal(f.page.data.sharing, true);
  await f.change('showDate', false); assert.equal(f.page.data.showDate, true);
  f.page.editSelection(); assert.equal(f.page.data.editing, false);
  await f.page.saveImage(); assert.equal(f.sent.length, 0);
  menu.fail({ errMsg: 'cancel' }); await sharing;
  assert.equal(f.page.data.sharing, false);
});

test('every long-image page respects hidden metadata and bounds a long nickname', () => {
  const painted = [];
  const ctx = { measureText: text => ({ width: Array.from(text).length * 17 }), fillRect() {}, drawImage() {}, fillText: (text, x, y) => painted.push({ text, x, y }) };
  const canvas = { getContext: () => ctx };
  const content = 'Another day 🌿 '.repeat(1400);
  for (const layout of ['separate', 'overlay']) for (const width of [720, 1080]) {
    const photos = Array.from({ length: 9 }, () => ({ width: 600, height: 900 }));
    const entry = buildShareCopy(original, content, [], { showDate: false, showMood: false, showSignature: true, nickname: 'Long昵称'.repeat(30) }).entry;
    const plan = planCard(ctx, entry.content, photos, layout, { showDate: false, width });
    assert.ok(plan.pages.length > 1);
    assert.equal(plan.pages.flatMap(page => page.lines).join(''), entry.content);
    for (let i = 0; i < plan.pages.length; i++) {
      painted.length = 0; drawCard(canvas, photos, entry, plan, i, 'en');
      assert.ok(canvas.height <= MAX_HEIGHT);
      assert.ok(!painted.some(item => /08\/09\/2026|Calm|Daily life|PRIVATE/.test(item.text)));
      const signature = painted.find(item => item.text.startsWith('Long昵称'));
      assert.ok(signature); assert.ok(ctx.measureText(signature.text).width <= 592 * plan.scale);
      assert.ok(signature.y > plan.pages[i].top + plan.pages[i].lines.length * plan.lineHeight);
    }
  }
});

test('share settings and fixed safe-area actions are localized and hide during editing', () => {
  const wxml = read('pages/share/share.wxml'), css = read('pages/share/share.wxss');
  for (const text of ['分享设置', '显示日期', '显示心情与分类', '显示昵称署名', '发送给朋友', '只分享你选中的内容，原记录仍仅自己可见。']) {
    assert.ok(wxml.includes(text)); assert.doesNotMatch(t(text, 'en'), /[\u4e00-\u9fff]/);
  }
  assert.match(css, /\.share-actions \{ position: fixed;/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.ok(wxml.indexOf('<block wx:if="{{!editing}}">') < wxml.indexOf('class="share-actions"'));
  assert.doesNotMatch(wxml, /发送给朋友 \/ 朋友圈|禁止下载|禁止转发/);
});
