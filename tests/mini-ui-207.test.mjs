import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-207-baseline.json'));
const sha = source => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.7';

test('2.0.7 website theme keeps font fallbacks, visible controls and contrasting modes', () => {
  const css = read('app/globals.css').split('/* 2.0.7 presentation-only sync')[1];
  assert.ok(css);
  assert.match(css, /--serif: system-ui, -apple-system/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /\.clear-mode \.life-focus/);
  assert.match(css, /background: #111116; color: #f5f5f7/);
  assert.match(css, /\.record-actions button \{ min-height: 44px/);
  assert.doesNotMatch(css, /@import|url\(https?:|animation:/);
});

// Compare all data expressions and non-visual attributes against the immutable
// 2.0.6 snapshot, including events, datasets, disabled/loading, loops and IDs.
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, '').replace(/\s+/g, ' ').replace(/\s*\/?>$/, '>'))
    .filter(t => t.slice(1, -1).trim().includes(' '));
  return sha(JSON.stringify({expressions, tags}));
}

test('2.0.7 preserves every runtime JS, policy, configuration, backend and database file', {skip:!release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    // The follow-up explicitly authorizes syncing website presentation only.
    // Keep the original baseline for every other file, especially TSX and APIs.
    if (path === 'app/globals.css') continue;
    assert.equal(sha(read(path)), expected, path);
  }
});

for (const [path, expected] of Object.entries(baseline.markup)) {
  test('2.0.7 visual rewrite retains complete binding contract: ' + path, {skip:!release}, () => {
    assert.equal(contract(read(path)), expected, path);
  });
}

test('2.0.7 keeps real data, private records and native canvas rather than mock design actions', {skip:!release}, () => {
  for (const path of Object.keys(baseline.markup)) {
    const markup = read(path);
    assert.match(markup, /ui-207/);
    assert.match(markup, /module="i18n"/);
    assert.doesNotMatch(markup, /onSubmitTarget|togglePrivacyPreview|onGenerateSharePoster|onSavePosterToAlbum|24,812|42\.8k|365 天内硬性|千日认知演进|qr-mock/);
  }
  assert.match(read('miniprogram/pages/share/share.wxml'), /id="shareCanvas"/);
  assert.match(read('miniprogram/pages/record/record.wxml'), /id="photoCanvas"/);
});

test('2.0.7 scoped surfaces support both themes without heavy effects or external assets', {skip:!release}, () => {
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
  for (const [foreground, background] of [['62626b','f5f5f7'], ['72727b','ffffff'], ['80600b','f7f1df'], ['b0b0b9','151518'], ['9898a3','151518'], ['d4af37','111116'], ['1c1c1e','f5f5f7']]) {
    const values = [luminance(foreground), luminance(background)].sort((a,b) => b-a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, foreground + '/' + background);
  }
});
