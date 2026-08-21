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

test("database migration enforces ownership and the one-year target lock", async () => {
  const sql = await source("supabase/migrations/20260821000000_lifescale_core.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /enforce_profile_target_lock/);
  assert.match(sql, /now\(\) \+ interval '1 year'/);
  assert.match(sql, /actual_death_date/);
  assert.match(sql, /storage\.objects/);
  assert.match(sql, /bucket_id = 'entry-media'/);
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
