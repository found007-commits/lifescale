import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("email OTP is the only enabled login method", async () => {
  const [auth, config] = await Promise.all([source("app/components/AuthPanel.tsx"), source("app/api/config/route.ts")]);
  assert.match(auth, /signInWithOtp/);
  assert.match(auth, /verifyOtp/);
  assert.match(config, /google:\s*false/);
  assert.match(config, /apple:\s*false/);
  assert.match(config, /facebook:\s*false/);
});

test("database migrations enforce ownership and a permanent core-target lock", async () => {
  const [sql, permanentLock, privateOnly] = await Promise.all([
    source("supabase/migrations/20260821000000_lifescale_core.sql"),
    source("supabase/migrations/20260821193000_permanent_core_target_lock.sql"),
    source("supabase/migrations/20260822090000_private_records_only.sql"),
  ]);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(permanentLock, /enforce_profile_target_lock/);
  assert.match(permanentLock, /can only be confirmed once/);
  assert.doesNotMatch(permanentLock, /interval '1 year'/);
  assert.match(sql, /actual_death_date/);
  assert.match(sql, /storage\.objects/);
  assert.match(sql, /bucket_id = 'entry-media'/);
  assert.match(privateOnly, /entries_select_own/);
  assert.match(privateOnly, /visibility = 'private'/);
  assert.match(privateOnly, /life_entries_private_only/);
  assert.match(privateOnly, /drop policy if exists "entries_select_own_or_public"/);
  assert.doesNotMatch(privateOnly, /create policy "entries_select_own_or_public"/);
});

test("registration explains the privacy boundary and records have no public option", async () => {
  const [auth, onboarding, composer] = await Promise.all([
    source("app/components/AuthPanel.tsx"),
    source("app/components/Onboarding.tsx"),
    source("app/components/EntryComposer.tsx"),
  ]);
  assert.match(auth, /记录默认仅你可见/);
  assert.match(auth, /没有供创作者或运营人员浏览、修改/);
  assert.match(onboarding, /核心资料只确认一次/);
  assert.match(composer, /不提供公开选项/);
  assert.doesNotMatch(composer, /option value="public"/);
});

test("local storage is limited to preview, theme and draft state", async () => {
  const files = ["app/components/Experience.tsx", "app/components/Onboarding.tsx", "lib/use-theme.ts", "app/components/Dashboard.tsx", "lib/lifescale-data.ts"];
  const combined = (await Promise.all(files.map(source))).join("\n");
  for (const match of combined.matchAll(/localStorage\.[^(]+\(([^)]*)\)/g)) assert.match(match[1], /lifescale:(preview-draft|theme)/);
  assert.doesNotMatch(await source("app/components/Dashboard.tsx"), /localStorage/);
  assert.doesNotMatch(await source("lib/lifescale-data.ts"), /localStorage/);
});

test("the web app presents the 余生有刻 product brand", async () => {
  const [brand, layout, manifest, experience] = await Promise.all([
    source("app/components/Brand.tsx"),
    source("app/layout.tsx"),
    source("app/manifest.ts"),
    source("app/components/Experience.tsx"),
  ]);
  for (const file of [brand, layout, manifest]) assert.match(file, /余生有刻/);
  assert.match(layout, /看见余生，认真今天/);
  assert.doesNotMatch(`${brand}\n${layout}\n${manifest}\n${experience}`, /人生刻度/);
});

test("account deletion uses two click confirmations without typed DELETE", async () => {
  const dashboard = await source("app/components/Dashboard.tsx");
  assert.equal((dashboard.match(/window\.confirm\(/g) || []).length >= 2, true);
  assert.doesNotMatch(dashboard, /window\.prompt\(|请输入 DELETE|Type DELETE/);
  assert.match(dashboard, /请再次确认/);
});
