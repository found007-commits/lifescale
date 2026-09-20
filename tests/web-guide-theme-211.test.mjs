import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-2011-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-2010-baseline.json'));
const sha = source => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.11';

// Compare all data expressions and non-visual attributes against the frozen snapshot,
// including events, datasets, disabled/loading, loops and IDs.
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, '').replace(/\s+/g, ' ').replace(/\s*\/?>$/, '>'))
    .filter(t => t.slice(1, -1).trim().includes(' '));
  return sha(JSON.stringify({expressions, tags}));
}

test('2.0.11 preserves every runtime JS, policy, configuration, backend and database file', {skip:!release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

const WEBSITE_SCOPE = new Set([
  'app/chapters/page.tsx',
  'app/components/GuidePage.tsx',
  'app/globals.css',
  'app/sanctuary/page.tsx',
]);

test('2.0.11 changes exactly the four website files it intends and nothing else', {skip:!release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(changed, [...WEBSITE_SCOPE].sort());
  assert.equal(Object.keys(baseline.protectedFiles).length, Object.keys(previous.protectedFiles).length);
  assert.deepEqual(Object.keys(baseline.protectedFiles).sort(), Object.keys(previous.protectedFiles).sort());
});

// The watch list may only grow. This is the assertion the release script's own bug would have
// failed: it chose its parent fixture with a plain string sort, and as text
// "ui-2010-baseline.json" sorts before "ui-207-baseline.json". Writing 2.0.11 therefore
// inherited 2.0.9's list, came out with 120 files instead of 121, and dropped the component
// 2.0.10 had added - with no error and no output that looked wrong. Comparing the two most
// recent fixtures by number is what makes that visible here rather than in a later audit.
test('2.0.11 inherited every file the previous release protected', {skip:!release}, () => {
  const lost = Object.keys(previous.protectedFiles).filter((path) => !(path in baseline.protectedFiles));
  assert.deepEqual(lost, [], 'files dropped from the watch list: ' + lost.join(', '));
  assert.ok(baseline.protectedFiles['app/components/LocaleSelect.tsx'], 'the 2.0.10 component is still watched');
});

test('no release ever shrank the watch list', () => {
  // Same invariant, over the whole fixture history rather than just the last hop. Read the
  // numbers out of the file names, because sorting the names as text puts ui-2010 before
  // ui-207 and would compare the wrong pairs.
  const fixtures = readdirSync(new URL('../tests/fixtures', import.meta.url))
    .filter((name) => /^ui-\d+-baseline\.json$/.test(name))
    .map((name) => ({name, version: Number(/^ui-(\d+)-baseline\.json$/.exec(name)[1])}))
    .sort((a, b) => a.version - b.version);
  assert.ok(fixtures.length >= 4, 'expected several fixtures to compare, found ' + fixtures.length);
  for (let i = 1; i < fixtures.length; i++) {
    const before = JSON.parse(read('tests/fixtures/' + fixtures[i - 1].name));
    const after = JSON.parse(read('tests/fixtures/' + fixtures[i].name));
    for (const key of ['protectedFiles', 'markup']) {
      const lost = Object.keys(before[key]).filter((path) => !(path in after[key]));
      assert.deepEqual(lost, [], `${fixtures[i - 1].name} -> ${fixtures[i].name}: ${key} lost ${lost.join(', ')}`);
    }
  }
});

test('2.0.11 leaves the whole mini program and every migration byte identical to 2.0.10', {skip:!release}, () => {
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
  test('2.0.11 binding contract is frozen: ' + path, {skip:!release}, () => {
    assert.equal(contract(read(path)), expected, path);
  });
}

test('2.0.11 stops a rule meant for the back link from dragging the brand across the header', {skip:!release}, () => {
  const css = read('app/globals.css');
  // The brand renders as an <a>, so the rule that right-aligns the back link caught it too and
  // left the whole left half of the header empty. Excluding the brand is the whole fix.
  assert.match(css, /\.legal-header > a:not\(\.brand\) \{ justify-self: end; \}/);
  // And the unqualified form must be gone: leaving it anywhere would put the brand back on the
  // right on every page that uses this header.
  assert.doesNotMatch(css, /\.legal-header > a \{ justify-self: end; \}/);
  // The rule is shared by the guide pages and the four legal pages, which is why one selector
  // fixes five headers; four of them were not touched by this release at all.
  for (const path of ['app/privacy/page.tsx', 'app/terms/page.tsx', 'app/third-parties/page.tsx', 'app/account-deletion/page.tsx']) {
    assert.doesNotThrow(() => read(path), path);
  }
});

test('2.0.11 gives the guide pages the same theme control the landing page has', {skip:!release}, () => {
  const guide = read('app/components/GuidePage.tsx');
  assert.match(guide, /import \{ useTheme \} from "\.\.\/\.\.\/lib\/use-theme"/);
  assert.match(guide, /const \{ theme, setTheme \} = useTheme\(\)/);
  // The control sits in the header's action row, and it comes before the language control in
  // the same order the landing header uses, so the two headers do not reshuffle their buttons.
  assert.match(guide, /<div className="header-actions">[\s\S]*?<button className="theme-button"[\s\S]*?<LocaleSelect/);
  // The accessible name is copy, so it is passed in rather than written in the shell.
  assert.match(guide, /aria-label=\{t\.theme\}/);
  assert.match(guide, /\{theme === "light" \? "◐" : "☼"\}/);
  assert.doesNotMatch(guide, /[\u4e00-\u9fff]/);
  // Nothing in the guide pages may invent its own strings: the landing header's wording is
  // the wording a screen reader must hear on both.
  const experience = read('app/components/Experience.tsx');
  for (const label of ['切换明暗模式', 'Toggle color theme']) {
    assert.ok(experience.includes('theme: "' + label + '"'), 'the landing page lost: ' + label);
  }
  for (const path of ['app/chapters/page.tsx', 'app/sanctuary/page.tsx']) {
    const source = read(path);
    assert.match(source, /theme: "切换明暗模式"/, path);
    assert.match(source, /theme: "Toggle color theme"/, path);
  }
});

test('2.0.11 gives every guide page the theme label in both languages', {skip:!release}, () => {
  const KEYS = ['eyebrow', 'title', 'updated', 'lead', 'figure', 'value', 'caption', 'facts', 'heading', 'body', 'sections', 'bullets', 'note', 'back', 'privacy', 'language', 'theme', 'footer', 'label', 'href'];
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
    assert.doesNotMatch(en, /[\u4e00-\u9fff]/);
    assert.match(zh, /[\u4e00-\u9fff]/);
  }
});

test('2.0.11 adds no palette and no effect the existing themes cannot carry', {skip:!release}, () => {
  const css = read('app/globals.css');
  // This release adds no new rule block - it repairs an existing selector and reuses the
  // theme button the landing page already styles - so the check is that the stylesheet's
  // token vocabulary did not grow, rather than that a marked block is present.
  const start = css.indexOf('/* 2.0.11 website:');
  assert.ok(start > 0, 'the 2.0.11 comment lost its marker');
  const added = css.slice(start, css.indexOf('*/', start));
  assert.doesNotMatch(added, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(added, /--[\w-]+\s*:/);
  // The theme button is styled by a rule that predates this release; if that rule ever lost
  // its own tokens the guide header would be the second place to notice.
  assert.match(css, /\.theme-button \{ width: 36px; height: 36px;[^}]*color: var\(--green\);/);
  // The narrow-width behaviour is inherited rather than reimplemented: the landing page hides
  // its theme button below 760px and the guide header shares that selector through
  // .header-actions, so the two agree without either naming the guide header.
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.header-actions \.theme-button \{ display: none; \}/);
});
