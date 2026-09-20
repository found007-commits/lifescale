import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-208-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-207-baseline.json'));
const sha = source => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.8';

// Compare all data expressions and non-visual attributes against the frozen snapshot,
// including events, datasets, disabled/loading, loops and IDs.
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, '').replace(/\s+/g, ' ').replace(/\s*\/?>$/, '>'))
    .filter(t => t.slice(1, -1).trim().includes(' '));
  return sha(JSON.stringify({expressions, tags}));
}

test('2.0.8 preserves every runtime JS, policy, configuration, backend and database file', {skip:!release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// 2.0.8 is a mini program release with one new migration. Nothing under app/, lib/ or the
// existing API routes may move, which is what makes "the website is untouched" checkable
// instead of asserted. app/globals.css is exempt because its 2.0.7 hash predates the
// separately authorised website sync; its current value is frozen in the 2.0.8 fixture.
const MINI_PROGRAM_SCOPE = new Set([
  'miniprogram/app.json',
  'miniprogram/pages/settings/settings.js',
  'miniprogram/utils/app-share.js',
  'miniprogram/utils/life.js',
  'miniprogram/utils/locale-copy.js',
  'miniprogram/utils/locale-dictionary.json',
  'miniprogram/utils/locale.wxs',
  'miniprogram/utils/localized-page.js',
  'miniprogram/utils/supabase.js',
]);

test('2.0.8 leaves the website, the APIs and lib/ byte identical to 2.0.7', {skip:!release}, () => {
  for (const [path, hash] of Object.entries(previous.protectedFiles)) {
    if (MINI_PROGRAM_SCOPE.has(path) || path === 'app/globals.css') continue;
    assert.equal(sha(read(path)), hash, path);
  }
  // The migration directory is additive: every 2.0.7 migration is still byte identical.
  for (const path of Object.keys(previous.protectedFiles)) {
    if (!path.startsWith('supabase/migrations/')) continue;
    assert.equal(sha(read(path)), previous.protectedFiles[path], path);
  }
});

for (const [path, expected] of Object.entries(baseline.markup)) {
  test('2.0.8 binding contract is frozen: ' + path, {skip:!release}, () => {
    assert.equal(contract(read(path)), expected, path);
  });
}

test('2.0.8 ships real data, private records and native canvas rather than mock design actions', {skip:!release}, () => {
  for (const path of Object.keys(baseline.markup)) {
    const markup = read(path);
    assert.match(markup, /ui-207/);
    assert.match(markup, /module="i18n"/);
    assert.doesNotMatch(markup, /onSubmitTarget|togglePrivacyPreview|onGenerateSharePoster|onSavePosterToAlbum|24,812|42\.8k|365 天内硬性|千日认知演进|qr-mock/);
  }
  assert.match(read('miniprogram/pages/share/share.wxml'), /id="shareCanvas"/);
  assert.match(read('miniprogram/pages/record/record.wxml'), /id="photoCanvas"/);
  // The sanctuary is not a mock either: it reads and writes the real tables.
  const space = read('miniprogram/subpackages/sanctuary/pages/space/space.js');
  assert.match(space, /getSanctuaryProfile/);
  assert.match(space, /listSanctuaryTributes/);
  assert.match(read('miniprogram/subpackages/sanctuary/pages/editor/editor.js'), /saveSanctuaryProfile/);
  assert.match(read('miniprogram/subpackages/sanctuary/pages/tribute/tribute.js'), /addSanctuaryTribute/);
});

test('2.0.8 scoped surfaces support both themes without heavy effects or external assets', {skip:!release}, () => {
  const global = read('miniprogram/app.wxss');
  assert.match(global, /\.ui-207 \{/);
  assert.match(global, /prefers-color-scheme: dark/);
  for (const path of Object.keys(baseline.markup)) {
    assert.doesNotMatch(read(path.replace('.wxml', '.wxss')), /backdrop-filter|@import|url\(https?:|animation:/);
  }
  const luminance = hex => {
    const channels = hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  // Every pair below is a combination the shipped stylesheets actually use. The sanctuary
  // adds the gold-on-gold-glow badge, the danger surface of its delete button and the
  // tertiary timestamp inside a card.
  const pairs = [
    ['1c1c1e', 'f5f5f7'], ['62626b', 'f5f5f7'], ['62626b', 'ffffff'], ['62626b', 'ededf0'],
    ['72727b', 'ffffff'], ['80600b', 'f7f1df'], ['62626b', 'f7f1df'], ['1c1c1e', 'f7f1df'],
    ['a33737', 'faeeee'], ['1c1c1e', 'ffffff'],
    ['b0b0b9', '151518'], ['9898a3', '151518'], ['d4af37', '111116'], ['d4af37', '282316'],
    ['f5f5f7', '151518'], ['f5f5f7', '0a0a0c'], ['f5f5f7', '222226'], ['f0a3a3', '302022'],
  ];
  for (const [foreground, background] of pairs) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, foreground + '/' + background);
  }
});
