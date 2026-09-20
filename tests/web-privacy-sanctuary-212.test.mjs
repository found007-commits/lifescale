import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/ui-2012-baseline.json'));
const previous = JSON.parse(read('tests/fixtures/ui-2011-baseline.json'));
const sha = (source) => createHash('sha256').update(source).digest('hex');
const release = JSON.parse(read('miniprogram/package.json')).version === '2.0.12';
const dict = JSON.parse(read('miniprogram/utils/locale-dictionary.json'));

const CJK = /[\u4e00-\u9fff]/;

test('2.0.12 preserves every runtime JS, policy, configuration, backend and database file', {skip: !release}, () => {
  for (const [path, expected] of Object.entries(baseline.protectedFiles)) {
    assert.equal(sha(read(path)), expected, path);
  }
});

// The whole release is a wording change. Anything else moving would mean the copy edit dragged
// code along with it.
const INTENDED = new Set([
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'miniprogram/pages/legal/legal.js',
  'miniprogram/utils/locale-copy.js',
  'miniprogram/utils/locale-dictionary.json',
  'miniprogram/utils/locale.wxs',
]);

test('2.0.12 changes exactly the six files it intends and nothing else', {skip: !release}, () => {
  const changed = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(changed, [...INTENDED].sort());
  assert.deepEqual(Object.keys(baseline.protectedFiles).sort(), Object.keys(previous.protectedFiles).sort());
});

test('2.0.12 changes no mini program behaviour: only the legal page and the generated copy', {skip: !release}, () => {
  const touchedMini = Object.entries(previous.protectedFiles)
    .filter(([path, hash]) => path.startsWith('miniprogram/') && sha(read(path)) !== hash)
    .map(([path]) => path)
    .sort();
  assert.deepEqual(touchedMini, [
    'miniprogram/pages/legal/legal.js',
    'miniprogram/utils/locale-copy.js',
    'miniprogram/utils/locale-dictionary.json',
    'miniprogram/utils/locale.wxs',
  ]);
  // A count of zero migrations moved would be a broken prefix rather than a clean release.
  const migrations = Object.keys(previous.protectedFiles).filter((p) => p.startsWith('supabase/'));
  assert.equal(migrations.length, 12);
  for (const path of migrations) assert.equal(sha(read(path)), previous.protectedFiles[path], path);
});

test('2.0.12 inherited every file the previous release protected', {skip: !release}, () => {
  const lost = Object.keys(previous.protectedFiles).filter((path) => !(path in baseline.protectedFiles));
  assert.deepEqual(lost, [], 'files dropped from the watch list: ' + lost.join(', '));
  assert.ok(baseline.protectedFiles['app/components/LocaleSelect.tsx'], 'the 2.0.10 component is still watched');
});

test('no release ever shrank the watch list', () => {
  const fixtures = readdirSync(new URL('../tests/fixtures', import.meta.url))
    .filter((name) => /^ui-\d+-baseline\.json$/.test(name))
    .map((name) => ({name, version: Number(/^ui-(\d+)-baseline\.json$/.exec(name)[1])}))
    .sort((a, b) => a.version - b.version);
  assert.ok(fixtures.length >= 5, 'expected several fixtures to compare, found ' + fixtures.length);
  for (let i = 1; i < fixtures.length; i++) {
    const before = JSON.parse(read('tests/fixtures/' + fixtures[i - 1].name));
    const after = JSON.parse(read('tests/fixtures/' + fixtures[i].name));
    for (const key of ['protectedFiles', 'markup']) {
      const lost = Object.keys(before[key]).filter((path) => !(path in after[key]));
      assert.deepEqual(lost, [], `${fixtures[i - 1].name} -> ${fixtures[i].name}: ${key} lost ${lost.join(', ')}`);
    }
  }
});

// ---- the point of the release: the published promise matches the shipped feature ----

// Every surface that promised "no public records, no comments from other users" has to stop
// saying that, because the sanctuary is exactly both of those things.
// The promise may survive only in its new, scoped form: the policies now say the *daily
// entries* have no public option, which is still true. So what has to be gone is the
// unrestricted claim, not the words - hence the lookbehind rather than a plain substring.
const RETRACTED = [
  /不提供公开记录或他人留言/,
  /不允许其他用户留言/,
  /(?<!日常)记录和图片不提供公开选项/,
  /(?<!日常)记录与图片仅本人可见，不提供公开选项/,
];

test('the retracted promise stays retracted, on every surface', () => {
  const surfaces = ['app/privacy/page.tsx', 'app/terms/page.tsx', 'miniprogram/pages/legal/legal.js'];
  for (const path of surfaces) {
    const source = read(path);
    for (const phrase of RETRACTED) {
      assert.doesNotMatch(source, phrase, `${path} still makes the unrestricted claim: ${phrase}`);
    }
  }
  // The scoped form must actually be there, or "removed" could just mean "deleted the policy".
  assert.match(read('app/privacy/page.tsx'), /日常记录和图片不提供公开选项/);
  assert.match(read('app/terms/page.tsx'), /日常记录与图片仅本人可见，不提供公开选项/);
  // The dictionary is a second copy of the same sentences; a stale key would keep the retracted
  // promise greppable and would still be what an English reader is shown if the page ever
  // referenced it again.
  const stale = Object.keys(dict).filter((k) => RETRACTED.some((re) => re.test(k)));
  assert.deepEqual(stale, [], 'the dictionary still carries the retracted promise: ' + stale.length);
});

test('both policy surfaces state the sanctuary in the same terms', () => {
  for (const path of ['app/privacy/page.tsx', 'app/terms/page.tsx', 'miniprogram/pages/legal/legal.js']) {
    const source = read(path);
    assert.match(source, /精神圣所/, path + ' must name the sanctuary');
    assert.match(source, /默认私密/, path + ' must say the sanctuary is private by default');
    assert.match(source, /亲手/, path + ' must say opening it is something the owner does by hand');
    assert.match(source, /改回私密/, path + ' must say the owner can retract it');
  }
  // The mini program surfaces the same facts as separate titled sections, because that page
  // renders an array of heading/body pairs rather than prose.
  const mini = read('miniprogram/pages/legal/legal.js');
  assert.match(mini, /heading: "精神圣所（可选公开）"/);
  assert.match(mini, /heading: "公开内容"/);
});

// The share exception is the one place a link carries an account identifier, so the release
// that documents the sanctuary has to document it too - otherwise the exception stays a
// repository-only fact.
test('both policy surfaces publish the share exception', () => {
  assert.match(read('app/privacy/page.tsx'), /唯一例外是当你本人查看自己已公开的精神圣所时，分享链接会带上你自己的标识/);
  assert.match(read('miniprogram/pages/legal/legal.js'), /唯一例外是：当你本人查看自己已公开的精神圣所时，分享链接会带上你自己的标识/);
});

// A policy sentence that overstates the implementation is worse than no sentence. The two
// numbers the sanctuary copy commits to are both enforcement, not aspiration.
test('the policy claims nothing the database does not enforce', () => {
  const raw = read('supabase/migrations/20260920120000_sanctuary_and_chapters.sql');
  // Comments have to go first: this migration's own header explains that it "grants nothing to
  // anon", and a naive search would read that sentence as the opposite of what it says.
  const migration = raw.replace(/--[^\n]*/g, '');
  const policy = read('miniprogram/pages/legal/legal.js') + read('app/privacy/page.tsx');

  // "each visitor is limited to 20 tributes per hour"
  assert.match(policy, /每小时最多 20 条/);
  assert.match(migration, /if v_used > 20 then/, 'the 20-per-hour cap must be enforced, not just described');

  // "nobody can post under someone else's identity"
  assert.match(policy, /访客不能代填他人身份|不能代填他人身份/);
  assert.match(migration, /guest_user_id = \(select auth\.uid\(\)\)/, 'a tribute must be written as its own author');

  // "only after you publish it can other signed-in users read it"
  assert.match(policy, /其他已登录用户/);
  assert.match(migration, /p\.is_public = true/, 'guest visibility must be gated on the opt-in flag');

  // ...and "signed in" is literal: no grant here may reach an anonymous visitor.
  //
  // Two traps in one line. The word "public" is also the schema name, so "insert into
  // public.sanctuary_tribute_limits" reads as a grant to `public` unless the match starts at a
  // word boundary. And a bare `doesNotMatch` over the whole file passes vacuously if the
  // migration simply stops granting anything - which is exactly the regression this is here to
  // catch. So: split into statements, keep the ones that actually grant, require at least one,
  // and require every one of them to name an authenticated role.
  const grants = migration
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /\bgrant\b/i.test(s));
  assert.ok(grants.length > 0, 'expected the sanctuary migration to grant something to signed-in users');
  for (const grant of grants) {
    assert.doesNotMatch(grant, /\bto\s+(anon|public)\b/i, 'nothing here may be open to anonymous visitors: ' + grant.slice(0, 80));
  }
  assert.ok(
    grants.some((s) => /\bto\s+authenticated\b/i.test(s)),
    'the sanctuary must be reachable by signed-in users, not locked to nobody'
  );
});

// ---- the generated files have to agree with the dictionary they come from ----

test('the regenerated locale files agree with the dictionary they come from', () => {
  const wxs = read('miniprogram/utils/locale.wxs');
  const copy = read('miniprogram/utils/locale-copy.js');
  const added = Object.entries(dict).filter(([zh]) => zh.includes('精神圣所') || zh.includes('公开内容'));
  assert.ok(added.length >= 4, 'expected the sanctuary copy in the dictionary, found ' + added.length);
  // The generated files hold JSON, so compare the escaped form: an English sentence that
  // contains a quotation mark is stored as \" and a raw substring search would miss it.
  const escape = (s) => JSON.stringify(s).slice(1, -1);
  for (const [zh, en] of added) {
    assert.ok(wxs.includes(zh), 'locale.wxs is missing: ' + zh.slice(0, 30));
    assert.ok(wxs.includes(escape(en)), 'locale.wxs is missing the English for: ' + zh.slice(0, 30));
    assert.ok(copy.includes(escape(en)), 'locale-copy.js is missing the English for: ' + zh.slice(0, 30));
  }
});

// The English page must not fall back to Chinese: that is what a mistyped dictionary key
// looks like, and it would ship a bilingual policy.
test('the legal page carries no untranslated Chinese', () => {
  const source = read('miniprogram/pages/legal/legal.js');
  const strings = [...new Set([...source.matchAll(/"([^"\\]*[\u4e00-\u9fff][^"\\]*)"/g)].map((m) => m[1]))];
  assert.ok(strings.length >= 40, 'expected the legal copy to be extracted, found ' + strings.length);
  const missing = strings.filter((s) => !(s in dict));
  assert.deepEqual(missing, [], 'untranslated: ' + missing.map((s) => s.slice(0, 24)).join(' | '));
  // And the translation must not itself contain Chinese.
  const stillChinese = strings.filter((s) => CJK.test(dict[s]));
  assert.deepEqual(stillChinese, []);
  // Nor may the English equal the Chinese, which is the other way a missing translation shows.
  const identical = strings.filter((s) => dict[s] === s);
  assert.deepEqual(identical, []);
});

test('2.0.12 dates the revision on both policies', {skip: !release}, () => {
  assert.match(read('app/privacy/page.tsx'), /updated="2026年9月20日"/);
  assert.match(read('app/terms/page.tsx'), /updated="2026年9月20日"/);
  assert.match(read('miniprogram/pages/legal/legal.js'), /updated: "更新于 2026 年 9 月 20 日"/);
  // The third-party notice did not change, so its date must not have moved with the others.
  assert.match(read('miniprogram/pages/legal/legal.js'), /updated: "更新于 2026 年 9 月 8 日"/);
});
