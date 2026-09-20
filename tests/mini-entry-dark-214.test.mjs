// 2.0.14 repairs three things on the record-detail page that only go wrong in dark mode, and
// one of them was not a colour at all. app.wxss declared .media-placeholder a second time
// *after* the dark media query; both rules carry the same specificity, so the later one won
// and the override written inside the query never applied. Nothing about that failure is
// visible in the source unless you notice the order, which is why the last test here is the
// general form of the mistake rather than a check on one selector.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-2014-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-2013-baseline.json'));
const sha = (source) => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.14';

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// A single pass that records every block with its selector, its nesting depth and the offsets
// of its braces. Declarations are not blocks; the only thing this file needs to know is which
// selector owns which range of text and how deeply it is nested.
function blocks(css) {
  const out = [];
  const stack = [];
  let cursor = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      stack.push({selector: css.slice(cursor, i).trim(), depth: stack.length + 1, open: i});
      cursor = i + 1;
    } else if (ch === '}') {
      const node = stack.pop();
      if (node) {
        node.close = i;
        out.push(node);
      }
      cursor = i + 1;
    }
  }
  return out;
}

const classCount = (selector) => (selector.match(/\.[\w-]+/g) || []).length;
const isDark = (selector) => selector.startsWith('@media') && /prefers-color-scheme:\s*dark/.test(selector);

// Which properties a block declares, folded into families. Selector alone is not enough: app.wxss
// has a `page` rule inside a dark query that sets background and colour, and a later `page` rule
// that sets custom properties. Sharing a selector is fine; sharing a property is not.
function families(body) {
  const out = new Set();
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (!property || /\s|\(/.test(property)) continue;
    if (property === 'background' || property.startsWith('background-')) out.add('background');
    else if (property === 'border' || /^border-(top|right|bottom|left)/.test(property)) out.add('border');
    else out.add(property);
  }
  return out;
}
const shares = (a, b) => [...a].filter((p) => b.has(p));

const wxssFiles = readdirSync(new URL('../miniprogram', import.meta.url), {recursive: true})
  .map(String)
  .filter((name) => name.endsWith('.wxss') && !name.includes('node_modules'))
  .map((name) => 'miniprogram/' + name)
  .sort();

test('every wxss file in the mini program is reachable from here', () => {
  assert.ok(wxssFiles.length >= 14, 'expected to find the whole stylesheet set, found ' + wxssFiles.length);
  assert.ok(wxssFiles.includes('miniprogram/app.wxss'));
  assert.ok(wxssFiles.includes('miniprogram/pages/entry/entry.wxss'));
});

// The general form. A dark override only wins if nothing of equal or greater weight for the
// same selector comes after it. This catches the class of bug 2.0.14 was fixing, wherever it
// reappears, instead of pinning the one selector that happened to break.
test('no dark override is cancelled by a later rule of the same weight', () => {
  const problems = [];
  let checked = 0;
  for (const file of wxssFiles) {
    const css = stripComments(read(file));
    const all = blocks(css);
    const darkQueries = all.filter((b) => isDark(b.selector));
    for (const media of darkQueries) {
      const inside = all.filter((b) => b.depth === media.depth + 1 && b.open > media.open && b.close < media.close);
      assert.ok(inside.length > 0, file + ' has a dark media query with no rules in it');
      for (const child of inside) {
        checked++;
        const wanted = families(css.slice(child.open + 1, child.close));
        for (const late of all) {
          if (late.depth !== 1) continue;
          if (late.open <= media.close) continue;
          if (late.selector !== child.selector) continue;
          if (classCount(late.selector) > classCount(child.selector)) continue;
          const clashing = [...shares(wanted, families(css.slice(late.open + 1, late.close)))];
          if (!clashing.length) continue;
          problems.push(`${file}: "${child.selector}" sets ${clashing.join(', ')} inside the dark query at offset ${media.open}, ` +
            `but an equally weighted rule for it appears afterwards at offset ${late.open}`);
        }
      }
    }
  }
  // A count of zero would mean the walker found nothing rather than that nothing is wrong.
  assert.ok(checked >= 10, 'expected to inspect the dark overrides, inspected ' + checked);
  assert.deepEqual(problems, []);
});

test('the media placeholder keeps its dark override above the rule that used to cancel it', () => {
  const css = stripComments(read('miniprogram/app.wxss'));
  const base = css.indexOf('\n.media-placeholder {');
  const override = css.indexOf('.media-placeholder { background: #192a22');
  assert.ok(base > -1, 'the base .media-placeholder rule is missing');
  assert.ok(override > -1, 'the dark override for .media-placeholder is missing');
  assert.ok(base < override, 'the base rule must come before the dark override, or the override is dead code');
});

test('the record-detail page overrides the three surfaces that do not survive dark mode', () => {
  const css = stripComments(read('miniprogram/pages/entry/entry.wxss'));
  const start = css.indexOf('@media (prefers-color-scheme: dark)');
  assert.ok(start > -1, 'entry.wxss needs a dark block');
  const dark = css.slice(start);
  // The light values have to survive: this is a dark override, not a rewrite.
  assert.match(css, /\.reply-preview\s*\{[^}]*background:\s*#e3ece3/, 'the light chip background was removed');
  assert.match(css, /\.comment\s*\{[^}]*border-top:\s*1rpx solid #c7d1ca/, 'the light hairline was removed');
  assert.match(dark, /\.reply-preview\s*\{[^}]*background:\s*#0f1c17/, 'reply preview background');
  assert.match(dark, /\.reply-preview\s*\{[^}]*color:\s*#edf3ef/, 'reply preview text colour');
  assert.match(dark, /\.comment\s*\{[^}]*border-top-color:\s*rgba\(237, 243, 239, \.12\)/, 'comment hairline');
  assert.match(dark, /\.edit-panel\s*\{[^}]*border-top-color:\s*rgba\(237, 243, 239, \.12\)/, 'edit panel hairline');
});

// The colours are checked arithmetically rather than by eye, and the retired combinations are
// asserted to have really been the failures being repaired.
test('the repaired pairs clear the threshold that the retired ones failed', () => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // The reply preview, before and after.
  assert.ok(ratio('#edf3ef', '#e3ece3') < 1.2, 'the retired combination really was invisible');
  assert.ok(ratio('#edf3ef', '#0f1c17') > 4.5, 'reply preview text on its new dark chip');
  assert.ok(ratio('#123f31', '#e3ece3') > 4.5, 'the light chip keeps readable text');
  // The placeholder label the dead override was supposed to colour.
  assert.ok(ratio('#91a69b', '#192a22') > 4.5, 'media placeholder label on the dark card');
  assert.ok(ratio('#123f31', '#192a22') < 2, 'inheriting the light ink onto the dark card would fail');
});

test('2.0.14 preserves every runtime JS, policy, configuration, backend and database file', {skip: !release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// This release is styling only. Every file it touches is outside the watch list, which is worth
// asserting rather than assuming: a stylesheet fix that quietly reached into a page script
// would show up here.
test('2.0.14 changes no protected file at all', {skip: !release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(changed, []);
});

test('2.0.14 keeps every markup contract byte-identical', {skip: !release}, () => {
  for (const [path, hash] of Object.entries(previous.markup)) {
    assert.equal(baseline.markup[path], hash, path);
  }
  assert.ok(Object.keys(previous.markup).length >= 9, 'expected the full markup contract set');
});

test('2.0.14 inherits the watch list whole and adds nothing to it', {skip: !release}, () => {
  const lost = Object.keys(previous.protectedFiles).filter((path) => !(path in baseline.protectedFiles));
  assert.deepEqual(lost, [], 'files dropped from the watch list: ' + lost.join(', '));
  const added = Object.keys(baseline.protectedFiles).filter((path) => !(path in previous.protectedFiles));
  assert.deepEqual(added, []);
  assert.equal(Object.keys(baseline.protectedFiles).length, Object.keys(previous.protectedFiles).length);
});

test('2.0.14 moves the mini program version to 2.0.14', {skip: !release}, () => {
  assert.equal(JSON.parse(read('miniprogram/package.json')).version, '2.0.14');
});
