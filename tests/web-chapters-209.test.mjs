import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-209-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-208-baseline.json'));
const sha = source => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.9';

// Compare all data expressions and non-visual attributes against the frozen snapshot,
// including events, datasets, disabled/loading, loops and IDs.
function contract(source) {
  const expressions = [...source.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m => m[1]).sort();
  const tags = [...source.matchAll(/<[a-z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)]
    .map(m => m[0].replace(/\s+(?:class|style|color|placeholder-style)="[^"]*"/g, '').replace(/\s+/g, ' ').replace(/\s*\/?>$/, '>'))
    .filter(t => t.slice(1, -1).trim().includes(' '));
  return sha(JSON.stringify({expressions, tags}));
}

test('2.0.9 preserves every runtime JS, policy, configuration, backend and database file', {skip:!release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// 2.0.9 is a website release. The 120 protected files are inherited from the 2.0.8 fixture
// plus the three new website sources, so nothing stopped being watched when the version
// moved. The central claim of this release is "the website moved, the mini program did
// not", and the only way to make that checkable is to name the exact change set and then
// recompute every hash against the previous fixture.
const WEBSITE_SCOPE = new Set([
  'app/components/Experience.tsx',
  'app/globals.css',
  'lib/life-calculations.ts',
]);

test('2.0.9 changes exactly the three website files it intends and nothing else', {skip:!release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(changed, [...WEBSITE_SCOPE].sort());
});

test('2.0.9 leaves the whole mini program and every migration byte identical to 2.0.8', {skip:!release}, () => {
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
  test('2.0.9 binding contract is frozen: ' + path, {skip:!release}, () => {
    assert.equal(contract(read(path)), expected, path);
  });
}

test('2.0.9 states the chapter model on the landing page and on two new guide pages', {skip:!release}, () => {
  const experience = read('app/components/Experience.tsx');
  // The landing page reaches both guide pages from the navigation and from the footer, and
  // anchors its own chapter section.
  assert.match(experience, /href="#chapters"/);
  assert.match(experience, /id="chapters"/);
  assert.match(experience, /href="\/chapters"/);
  assert.match(experience, /href="\/sanctuary"/);
  // The five routes that existed before this release are still there; the two new ones sit
  // beside them instead of replacing anything.
  for (const route of ['app/page.tsx', 'app/privacy/page.tsx', 'app/terms/page.tsx', 'app/third-parties/page.tsx', 'app/account-deletion/page.tsx', 'app/chapters/page.tsx', 'app/sanctuary/page.tsx']) {
    assert.doesNotThrow(() => read(route), route);
  }
  for (const path of ['app/chapters/page.tsx', 'app/sanctuary/page.tsx']) {
    const source = read(path);
    assert.match(source, /export const metadata: Metadata/);
    assert.match(source, /copy: \{ zh: GuideCopy; en: GuideCopy \}/);
    assert.match(source, /<GuidePage initialLocale=\{initialLocale\} copy=\{copy\} \/>/);
    // Each guide page links to the other one, so the pair is discoverable without going
    // back to the landing page.
    assert.match(source, /\{ label: "双轨 1000 天", href: "\/chapters" \}/);
    assert.match(source, /\{ label: "精神圣所", href: "\/sanctuary" \}/);
    assert.match(source, /\{ label: "1,000-day chapters", href: "\/chapters" \}/);
    assert.match(source, /\{ label: "The sanctuary", href: "\/sanctuary" \}/);
  }
});

test('2.0.9 prints a chapter number only for a visitor who entered a birth date and a target', {skip:!release}, () => {
  const experience = read('app/components/Experience.tsx');
  // The live line is derived from the same metrics the free preview already computes, so
  // the two can never contradict each other, and it is rendered only when those metrics
  // exist. A visitor who has entered nothing is shown no chapter at all.
  assert.match(experience, /const chapters = useMemo\(\(\) => \(metrics \? calculateChapterMetrics\(metrics\.livedDays, metrics\.totalDays\) : null\), \[metrics\]\)/);
  assert.match(experience, /\{chapters && \(/);
  assert.match(experience, /aria-live="polite"/);
  // The free preview keeps its own promise: no figure before the visitor supplied age data.
  assert.match(experience, /if \(!birthDate \|\| !Number\.isInteger\(numericTargetAge\)[\s\S]*?\) return null;/);
});

test('2.0.9 serves the guide pages in every language instead of shipping Chinese only', {skip:!release}, () => {
  const guide = read('app/components/GuidePage.tsx');
  // The shared shell follows the same three rules the landing page follows: server-side
  // detection feeds the first render, the stored choice wins after hydration, and
  // traditional Chinese comes from the shared OpenCC pass rather than a second copy.
  assert.match(guide, /const t = copy\[locale === "zh-TW" \? "zh" : locale\]/);
  assert.match(guide, /localStorage\.getItem\("lifescale:locale"\)/);
  assert.match(guide, /useTraditionalChinese\(surfaceRef, locale\)/);
  // Not one character of copy lives in the component, which is why one component serves
  // two documents and three languages.
  assert.doesNotMatch(guide, /[\u4e00-\u9fff]/);

  // Both language copies carry the same structure, so the English page is not a stale
  // subset of the Chinese one: an equal count of every copy key, in both guide pages.
  const KEYS = ['eyebrow', 'title', 'updated', 'lead', 'figure', 'value', 'caption', 'facts', 'heading', 'body', 'sections', 'bullets', 'note', 'back', 'privacy', 'footer', 'label', 'href'];
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

test('2.0.9 adds no palette and no effect the existing themes cannot carry', {skip:!release}, () => {
  const css = read('app/globals.css');
  const start = css.indexOf('/* 2.0.9 website:');
  assert.ok(start > 0, 'the 2.0.9 block lost its marker comment');
  const added = css.slice(start);
  // The release is stated with the 2.0.7 tokens only: no literal colour, no new custom
  // property, no import, no remote asset, no filter and no animation.
  assert.doesNotMatch(added, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(added, /\brgba?\(/);
  assert.doesNotMatch(added, /@import|url\(|backdrop-filter|filter:|animation:|transition:/);
  assert.doesNotMatch(added, /--[\w-]+\s*:/);
  // Every token the new rules read is declared by the release palette, so the guide pages
  // follow the theme instead of falling back to an unset variable.
  const palette = paletteBlock(css, ':root', '--surface-soft');
  assert.ok(palette, 'the release palette block is missing');
  for (const [, token] of added.matchAll(/var\((--[\w-]+)/g)) {
    assert.ok(palette[token], token + ' is used but never declared');
  }
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

test('2.0.9 guide and chapter text keeps its contrast in both themes', {skip:!release}, () => {
  const css = read('app/globals.css');
  const light = paletteBlock(css, ':root', '--surface-soft');
  const dark = paletteBlock(css, ':root[data-theme="dark"]', '--surface-soft');
  assert.ok(light && dark, 'a release palette block is missing');
  const luminance = hex => {
    const channels = hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  // Each pair is a combination the 2.0.9 rules actually paint: body copy on the page and on
  // the soft figure surface, the muted metadata and footer line, and the gold eyebrow and
  // bullet dash. --serif is deliberately absent: it is a font stack, not a colour.
  const pairs = [
    ['--green', '--paper'], ['--green-2', '--paper'], ['--green-2', '--surface-soft'],
    ['--muted', '--paper'], ['--gold', '--paper'], ['--gold', '--surface-soft'],
  ];
  for (const [theme, palette] of [['light', light], ['dark', dark]]) {
    for (const [foreground, background] of pairs) {
      const fg = palette[foreground] ?? light[foreground];
      const bg = palette[background] ?? light[background];
      assert.match(fg, /^#[0-9a-f]{6}$/i, `${theme} ${foreground}`);
      assert.match(bg, /^#[0-9a-f]{6}$/i, `${theme} ${background}`);
      const [high, low] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      assert.ok((high + .05) / (low + .05) >= 4.5, `${theme}: ${foreground} on ${background} is ${fg} on ${bg}`);
    }
  }
});

test('2.0.9 publishes the share exception instead of leaving it in the repository', {skip:!release}, () => {
  const sanctuary = read('app/sanctuary/page.tsx');
  const readme = read('miniprogram/README.md');
  // A visitor is told the same thing the repository says, in both languages: the one
  // exception to "sharing never carries an account id", and its boundary.
  assert.match(sanctuary, /分享规则默认只分享应用本身/);
  assert.match(sanctuary, /分享卡片才会带上进入圣所的链接/);
  assert.match(sanctuary, /Sharing normally sends the app itself, with no account identifier attached/);
  assert.match(sanctuary, /未公开的记录、邮箱、出生日期、目标年龄与图片地址，在任何情况下都不会进入分享内容/);
  assert.match(sanctuary, /Unpublished entries, email addresses, birth dates, target ages and image URLs never enter any shared content/);
  assert.match(readme, /对 1\.2\.3 分享规则的唯一例外/);
  // The sanctuary is described as private by default and owner-controlled, which is what
  // the database policies actually enforce; the page must not promise more than that.
  assert.match(sanctuary, /默认私密/);
  assert.match(sanctuary, /Private by default/);
});
