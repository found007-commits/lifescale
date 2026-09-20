import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-2013-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-2012-baseline.json'));
const sha = (source) => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.13';

test('2.0.13 preserves every runtime JS, policy, configuration, backend and database file', {skip: !release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// The release is a theming change confined to the website shell plus one new component.
const INTENDED = new Set([
  'app/components/LegalPage.tsx',
  'app/globals.css',
  'app/layout.tsx',
]);

test('2.0.13 changes exactly the three files it intends and nothing else', {skip: !release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(changed, [...INTENDED].sort());
});

test('2.0.13 changes nothing in the mini program or the database', {skip: !release}, () => {
  const touchedMini = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => (path.startsWith('miniprogram/') || path.startsWith('supabase/')) && sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(touchedMini, []);
  // A count of zero would mean a broken prefix rather than a clean release.
  assert.equal(Object.keys(previous.protectedFiles).filter((p) => p.startsWith('miniprogram/')).length > 40, true);
  assert.equal(Object.keys(previous.protectedFiles).filter((p) => p.startsWith('supabase/')).length, 12);
});

test('2.0.13 inherited every file the previous release protected, and added the new component', {skip: !release}, () => {
  const lost = Object.keys(previous.protectedFiles).filter((path) => !(path in baseline.protectedFiles));
  assert.deepEqual(lost, [], 'files dropped from the watch list: ' + lost.join(', '));
  const added = Object.keys(baseline.protectedFiles).filter((path) => !(path in previous.protectedFiles));
  assert.deepEqual(added, ['app/components/ThemeButton.tsx']);
  assert.equal(Object.keys(baseline.protectedFiles).length, Object.keys(previous.protectedFiles).length + 1);
});

test('no release ever shrank the watch list', () => {
  const fixtures = readdirSync(new URL('../tests/fixtures/', import.meta.url))
    .filter((name) => /^ui-\d+-baseline\.json$/.test(name))
    .map((name) => ({version: Number(/^ui-(\d+)-baseline\.json$/.exec(name)[1]), name}))
    .sort((a, b) => a.version - b.version);
  assert.ok(fixtures.length >= 6, 'expected the full fixture series, found ' + fixtures.length);
  for (let i = 1; i < fixtures.length; i++) {
    const before = Object.keys(JSON.parse(read('tests/fixtures/' + fixtures[i - 1].name)).protectedFiles);
    const after = Object.keys(JSON.parse(read('tests/fixtures/' + fixtures[i].name)).protectedFiles);
    const lost = before.filter((path) => !after.includes(path));
    assert.deepEqual(lost, [], fixtures[i].name + ' dropped ' + lost.join(', '));
    // Binding contracts may be ADDED - 2.0.8 added three, because the sanctuary subpackage was
    // new and a new page brings its own contract. What must never happen is a contract being
    // dropped, or an existing one changing: that means a binding target moved on a page nobody
    // meant to touch, which is precisely the accident this watch list exists to catch.
    const beforeMarkup = JSON.parse(read('tests/fixtures/' + fixtures[i - 1].name)).markup;
    const afterMarkup = JSON.parse(read('tests/fixtures/' + fixtures[i].name)).markup;
    for (const [page, fingerprint] of Object.entries(beforeMarkup)) {
      assert.ok(page in afterMarkup, fixtures[i].name + ' dropped the contract for ' + page);
      assert.equal(afterMarkup[page], fingerprint, fixtures[i].name + ' changed the contract for ' + page);
    }
  }
});

test('2.0.13 keeps the nine binding contracts frozen', {skip: !release}, () => {
  assert.equal(Object.keys(baseline.markup).length, 9);
  assert.deepEqual(baseline.markup, previous.markup);
});

// ---- the theme now reaches the pages that never had one ----

// The bug was that nothing set the attribute on these routes. The fix is one script that runs
// before paint, so the assertion is that it exists, runs in the head, and writes the attribute.
test('the layout applies the stored theme before the first paint', () => {
  const layout = read('app/layout.tsx');
  const head = layout.indexOf('<head>');
  const body = layout.indexOf('<body');
  // The script tag, not the identifier - the constant is declared above the JSX, so looking for
  // its name would pass even if the tag were rendered into the body.
  const script = layout.indexOf('<script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />');
  assert.ok(script > -1, 'layout.tsx must render the theme init script');
  assert.ok(head > -1 && head < script, 'the script must sit inside <head>');
  assert.ok(script < body, 'the script must run before the body is painted');
  assert.match(layout, /document\.documentElement\.dataset\.theme\s*=/, 'the script has to set the attribute the CSS keys on');
  assert.match(layout, /data-theme/, 'and it has to be the theme attribute, not some other one');
});

// Drift between the two readers of this key is exactly the failure that would bring the bug back
// for the routes that still rely on the hook.
test('the init script and useTheme read the same storage key', () => {
  const layout = read('app/layout.tsx');
  const hook = read('lib/use-theme.ts');
  const key = /"lifescale:theme"/;
  assert.match(layout, key, 'the init script must read lifescale:theme');
  assert.match(hook, key, 'useTheme must keep reading lifescale:theme');
  // Both must fall back to the system preference in the same direction.
  for (const source of [layout, hook]) {
    assert.match(source, /prefers-color-scheme: dark/, 'both readers must honour the system preference');
  }
});

test('the legal pages carry a theme control that matches the home page one', () => {
  const page = read('app/components/LegalPage.tsx');
  const button = read('app/components/ThemeButton.tsx');
  assert.match(page, /<ThemeButton label=/, 'LegalPage must render the control');
  assert.match(page, /className="header-actions"/, 'and it belongs in the shared action row');
  // The same class and the same two glyphs, so the control is not a second design.
  assert.match(button, /className="theme-button"/);
  assert.match(button, /"◐"/);
  assert.match(button, /"☼"/);
  assert.match(button, /useTheme/);
  // The accessible name is supplied by the caller, which is what keeps the component reusable
  // and matches how LocaleSelect is wired.
  assert.match(button, /label \}: \{ label: string \}/);
});

test('the legal header layout stays with the shared rule', () => {
  const css = read('app/globals.css');
  // The back link moved inside the wrapper, so the wrapper needs the rule the header used to
  // give a direct child - and it has to cover both headers rather than only the guide one.
  assert.match(css, /\.legal-header \.header-actions > a \{/);
  assert.doesNotMatch(css, /\.guide-header \.header-actions > a \{/, 'the guide-only rule must not survive alongside it');
  // The control hides at the same breakpoint as elsewhere rather than inventing its own.
  assert.match(css, /\.header-actions \.theme-button \{ display: none; \}/);
});

test('the legal body text is darkened with a token, not a second literal', () => {
  const css = read('app/globals.css');
  // The literal stays for light, where it measures 5.53:1.
  assert.match(css, /\.legal-content p, \.legal-content li \{ color: #51685d;/);
  // Dark has to override it, on the same elements, with a token.
  assert.match(
    css,
    /:root\[data-theme="dark"\] \.legal-content p,\s*:root\[data-theme="dark"\] \.legal-content li \{ color: var\(--green-2\); \}/
  );
  // The dark secondary tone the override relies on must actually be defined, and defined dark.
  const dark = /:root\[data-theme="dark"\] \{[^}]*--green-2:\s*#b0b0b9;[^}]*\}/.exec(css.replace(/\n/g, ' '));
  assert.ok(dark, 'the dark theme must define --green-2 as #b0b0b9');
});

// Green is lighter or darker than the surface it sits on, so a token that reads well on one
// theme can be invisible on the other. Checked arithmetically rather than by eye.
test('the legal page colours clear the WCAG body text threshold', () => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (a, b) => { const x = L(a), y = L(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };
  // Light: the retained literal on the light paper.
  assert.ok(ratio('#51685d', '#ffffff') > 4.5, 'light legal body text');
  // Dark: the token on the dark paper.
  assert.ok(ratio('#b0b0b9', '#151518') > 4.5, 'dark legal body text');
  // And the retired combination really was the failure being fixed.
  assert.ok(ratio('#51685d', '#151518') < 4.5, 'the literal on dark paper was below threshold');
});

test('2.0.13 moves the mini program version to 2.0.13', {skip: !release}, () => {
  assert.equal(JSON.parse(read('miniprogram/package.json')).version, '2.0.13');
});
