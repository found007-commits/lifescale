import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-2010-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-209-baseline.json'));
const sha = source => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.10';

// Compare all data expressions and non-visual attributes against the frozen snapshot,
// including events, datasets, disabled/loading, loops and IDs.
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, '').replace(/\s+/g, ' ').replace(/\s*\/?>$/, '>'))
    .filter(t => t.slice(1, -1).trim().includes(' '));
  return sha(JSON.stringify({expressions, tags}));
}

test('2.0.10 preserves every runtime JS, policy, configuration, backend and database file', {skip:!release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// 2.0.10 is a website release like 2.0.9 was, so it has to name its exact change set and
// recompute every inherited hash against the previous fixture. Four files change and one is
// added; the added one is listed here as well as in the fixture, because a file that enters
// the watch list without being named in the release would be a silent widening of scope.
const WEBSITE_SCOPE = new Set([
  'app/chapters/page.tsx',
  'app/components/GuidePage.tsx',
  'app/components/LocaleSelect.tsx',
  'app/globals.css',
  'app/sanctuary/page.tsx',
]);

test('2.0.10 changes exactly the website files it intends and nothing else', {skip:!release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  // The four that already existed and were edited. LocaleSelect.tsx is new, so it is absent
  // from the previous fixture and cannot appear in this list; the entry below checks it
  // separately by requiring it to be present and protected.
  assert.deepEqual(changed, [...WEBSITE_SCOPE].filter(path => path in previous.protectedFiles).sort());
  assert.ok('app/components/LocaleSelect.tsx' in baseline.protectedFiles, 'the new component entered the watch list');
  assert.ok(!('app/components/LocaleSelect.tsx' in previous.protectedFiles), 'and it was not in the previous watch list');
});

test('2.0.10 leaves the whole mini program and every migration byte identical to 2.0.9', {skip:!release}, () => {
  const mini = Object.keys(previous.protectedFiles).filter(path => path.startsWith('miniprogram/'));
  const sql = Object.keys(previous.protectedFiles).filter(path => path.startsWith('supabase/'));
  // Both groups are non-empty on purpose: a glob that silently stops matching would make
  // this test pass while checking nothing.
  assert.equal(mini.length, 56);
  assert.equal(sql.length, 12);
  for (const path of [...mini, ...sql]) {
    assert.equal(sha(read(path)), previous.protectedFiles[path], path);
  }
});

for (const [path, expected] of Object.entries(baseline.markup)) {
  test('2.0.10 binding contract is frozen: ' + path, {skip:!release}, () => {
    assert.equal(contract(read(path)), expected, path);
  });
}

test('2.0.10 offers the language control on the page the visitor is already reading', {skip:!release}, () => {
  const guide = read('app/components/GuidePage.tsx');
  // The control sits in the header, next to the way back, and not somewhere the visitor has
  // to hunt for it.
  assert.match(guide, /<header className="legal-header guide-header">[\s\S]*?<LocaleSelect locale=\{locale\} label=\{t\.language\} onChange=\{changeLocale\} \/>[\s\S]*?<\/header>/);
  // Choosing writes the same key the landing page writes, so the two pages agree on which
  // language was asked for instead of each keeping its own answer.
  assert.match(guide, /window\.localStorage\.setItem\("lifescale:locale", next\)/);
  assert.match(guide, /localStorage\.getItem\("lifescale:locale"\)/);
  // The property that lets one component serve two documents and three languages is still
  // intact: not one character of copy lives in the shell.
  assert.doesNotMatch(guide, /[\u4e00-\u9fff]/);

  // The three names a language is offered under are the same strings on every page, so they
  // live in the control rather than in either document's copy.
  const select = read('app/components/LocaleSelect.tsx');
  for (const value of ['zh', 'zh-TW', 'en']) {
    assert.match(select, new RegExp('value: "' + value + '"'));
  }
  assert.match(select, /label: "简体中文"/);
  assert.match(select, /label: "繁體中文"/);
  assert.match(select, /label: "English"/);
  // The accessible name is passed in, not written in the component, which is what keeps the
  // component free of copy as well.
  assert.match(select, /label: string/);
  assert.doesNotMatch(select, /aria-label="Language"|>Language</);
});

test('2.0.10 cannot offer a language the application does not support', {skip:!release}, () => {
  // A picker that offers a value the Locale union does not contain would type check only
  // because of the cast on the change handler, and would then write an unsupported locale
  // into storage. Compare the two lists directly instead of trusting the cast.
  const declared = [...read('app/components/LocaleSelect.tsx').matchAll(/value: "([^"]+)"/g)].map(m => m[1]).sort();
  const supported = read('lib/types.ts').match(/export type Locale = ([^;]+);/)[1]
    .split('|').map(part => part.trim().replace(/^"|"$/g, '')).sort();
  assert.deepEqual(declared, supported);
  assert.equal(declared.length, 3);
});

test('2.0.10 gives every guide page the accessible name in both languages', {skip:!release}, () => {
  const KEYS = ['eyebrow', 'title', 'updated', 'lead', 'figure', 'value', 'caption', 'facts', 'heading', 'body', 'sections', 'bullets', 'note', 'back', 'privacy', 'language', 'footer', 'label', 'href'];
  for (const path of ['app/chapters/page.tsx', 'app/sanctuary/page.tsx']) {
    const source = read(path);
    const zhStart = source.indexOf('  zh: {');
    const enStart = source.indexOf('  en: {');
    const end = source.lastIndexOf('\n  },\n};');
    assert.ok(zhStart > 0 && enStart > zhStart && end > enStart, path);
    const [zh, en] = [source.slice(zhStart, enStart), source.slice(enStart, end)];
    for (const key of KEYS) {
      // A key is what follows a line start, a comma or an opening brace. Anchoring on those
      // two characters keeps "Last updated:" and "value for value:" inside a sentence from
      // being counted as keys, while still finding `figure: { value: ... }` on one line.
      const count = (text) => (text.match(new RegExp('(?:^|[,{])\\s*' + key + '\\s*:', 'gm')) || []).length;
      assert.equal(count(zh), count(en), `${path}: ${key} appears ${count(zh)}x in zh and ${count(en)}x in en`);
      assert.ok(count(zh) > 0, `${path}: ${key} is missing`);
    }
    // A leftover Chinese sentence in the English copy is the failure this catches.
    assert.doesNotMatch(en, /[\u4e00-\u9fff]/);
    assert.match(zh, /[\u4e00-\u9fff]/);
  }
});

test('2.0.10 adds no palette and no effect the existing themes cannot carry', {skip:!release}, () => {
  const css = read('app/globals.css');
  const start = css.indexOf('/* 2.0.10 website:');
  assert.ok(start > 0, 'the 2.0.10 block lost its marker comment');
  const added = css.slice(start);
  // The release is stated with the existing tokens only: no literal colour, no new custom
  // property, no import, no remote asset, no filter and no animation.
  assert.doesNotMatch(added, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(added, /\brgba?\(/);
  assert.doesNotMatch(added, /@import|url\(|backdrop-filter|filter:|animation:|transition:/);
  assert.doesNotMatch(added, /--[\w-]+\s*:/);
  // Every token the new rules read is declared by the release palette, so the guide header
  // follows the theme instead of falling back to an unset variable.
  const palette = paletteBlock(css, ':root', '--surface-soft');
  assert.ok(palette, 'the release palette block is missing');
  for (const [, token] of added.matchAll(/var\((--[\w-]+)/g)) {
    assert.ok(palette[token], token + ' is used but never declared');
  }
  // The header keeps the two properties that make it usable on a phone: the wordmark gives
  // way at the same width the landing header gives it way, and the link does not fall out
  // of the header's own colour rule when it moves inside the action row.
  assert.match(added, /@media \(max-width: 760px\)[\s\S]*?\.guide-header \.brand-type \{ display: none; \}/);
  assert.match(added, /\.guide-header \.header-actions > a \{ color: var\(--green-2\)/);
});

// Reads one declaration block, chosen by a token only the release palette declares, so the
// legacy token block earlier in the file cannot be mistaken for it.
function paletteBlock(source, selector, marker) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [, body] of source.matchAll(new RegExp(escaped + '\\s*\\{([^}]*)\\}', 'g'))) {
    if (!body.includes(marker)) continue;
    return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  }
  return null;
}
