import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const GUEST = "00000000-0000-0000-0000-0000000000a2";
const STRANGER = "00000000-0000-0000-0000-0000000000a3";

// Bootstraps only what the sanctuary migration depends on: the Supabase roles, an
// auth.uid() backed by request.jwt.claim.sub, and the two objects the core migration
// owns (public.profiles for the guest signature, public.set_updated_at for the trigger).
// Keeping the stand-ins minimal is deliberate — the assertions below are about the new
// migration's own guarantees.
const BOOTSTRAP = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  grant usage on schema auth, public to authenticated;
  grant execute on function auth.uid() to authenticated;
  create table public.profiles(id uuid primary key references auth.users(id), display_name text);
  create function public.set_updated_at() returns trigger language plpgsql
    security invoker set search_path = '' as $$
    begin new.updated_at = now(); return new; end;
  $$;
  insert into auth.users values ('${OWNER}'), ('${GUEST}'), ('${STRANGER}');
  insert into public.profiles values ('${GUEST}', '夜航者');
`;

const asUser = (id: string) => `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`;

const TRIBUTE = "insert into public.sanctuary_tributes(target_user_id,guest_user_id,tribute_kind,message) values ($1,$2,$3,$4)";

test("sanctuary migration keeps an unpublished sanctuary unreadable and unfakeable in Postgres", async () => {
  const db = new PGlite();
  try {
    await db.exec(BOOTSTRAP);
    const migration = read("supabase/migrations/20260920120000_sanctuary_and_chapters.sql");
    await db.exec(migration);
    // Re-running a migration must be safe: policies are dropped before they are created.
    await db.exec(migration);

    await db.exec(asUser(OWNER));
    await db.query("insert into public.sanctuary_profiles(user_id) values ($1)", [OWNER]);

    // 1. Creating a sanctuary publishes nothing. The default is the whole point.
    assert.equal((await db.query<{ is_public: boolean }>(
      "select is_public from public.sanctuary_profiles where user_id=$1", [OWNER])).rows[0].is_public, false);

    // 2. Another signed-in account cannot read an unpublished epitaph.
    await db.exec(asUser(STRANGER));
    assert.equal((await db.query("select epitaph from public.sanctuary_profiles")).rows.length, 0);

    // 3. The owner cannot write the derived counter, even on their own row.
    await db.exec(asUser(OWNER));
    await assert.rejects(
      db.query("update public.sanctuary_profiles set tribute_count=999 where user_id=$1", [OWNER]),
      /permission denied/);

    // 4. Publishing is one granted column, and it is what opens the row.
    await db.query("update public.sanctuary_profiles set is_public=true where user_id=$1", [OWNER]);
    await db.exec(asUser(STRANGER));
    assert.equal((await db.query("select epitaph from public.sanctuary_profiles")).rows.length, 1);

    // 5. A private sanctuary cannot receive tributes at all.
    await db.exec(asUser(STRANGER));
    await db.query("insert into public.sanctuary_profiles(user_id) values ($1)", [STRANGER]);
    await db.exec(asUser(GUEST));
    await assert.rejects(db.query(TRIBUTE, [STRANGER, GUEST, "spark", "hello"]), /row-level security/);

    // 6. The signature is not a client input: naming the column is itself denied.
    await assert.rejects(db.query(
      "insert into public.sanctuary_tributes(target_user_id,guest_user_id,guest_name,tribute_kind,message) values ($1,$2,'Forged','spark','x')",
      [OWNER, GUEST]), /permission denied/);

    // 7. A guest can leave a tribute, and the stored signature comes from their profile.
    await db.query(TRIBUTE, [OWNER, GUEST, "spark", "hello"]);
    assert.equal((await db.query<{ guest_name: string }>(
      "select guest_name from public.sanctuary_tributes")).rows[0].guest_name, "夜航者");

    // 8. Nobody can tribute their own sanctuary.
    await assert.rejects(db.query(TRIBUTE, [GUEST, GUEST, "spark", "me"]),
      /cannot leave a tribute|row-level security/);

    // 9. A whitespace-only note is stored as empty; an over-long one is refused.
    await db.query(TRIBUTE, [OWNER, GUEST, "flower", "   "]);
    assert.equal((await db.query<{ message: string }>(
      "select message from public.sanctuary_tributes order by created_at desc, id desc limit 1")).rows[0].message, "");
    await assert.rejects(db.query(TRIBUTE, [OWNER, GUEST, "spark", "a".repeat(201)]), /check constraint/);

    // 10. The counter is maintained server side, not by the caller.
    assert.equal((await db.query<{ tribute_count: number }>(
      "select tribute_count from public.sanctuary_profiles where user_id=$1", [OWNER])).rows[0].tribute_count, 2);

    // 11. Twenty tributes per guest per hour. Two are already spent, so the 21st fails.
    for (let index = 0; index < 18; index += 1) await db.query(TRIBUTE, [OWNER, GUEST, "spark", `note ${index}`]);
    await assert.rejects(db.query(TRIBUTE, [OWNER, GUEST, "spark", "one too many"]), /Too many tributes/);
    assert.equal((await db.query<{ tribute_count: number }>(
      "select tribute_count from public.sanctuary_profiles where user_id=$1", [OWNER])).rows[0].tribute_count, 20);

    // 12. A bystander cannot clear somebody else's wall; the policy filters silently.
    await db.exec(asUser(STRANGER));
    await db.query("delete from public.sanctuary_tributes where target_user_id=$1", [OWNER]);
    assert.equal((await db.query("select id from public.sanctuary_tributes where target_user_id=$1", [OWNER])).rows.length, 20);

    // 13. The host can clear their own wall.
    await db.exec(asUser(OWNER));
    await db.query("delete from public.sanctuary_tributes where target_user_id=$1", [OWNER]);
    assert.equal((await db.query("select id from public.sanctuary_tributes where target_user_id=$1", [OWNER])).rows.length, 0);

    // 14. Anonymous callers reach neither table, which is what the draft migration missed.
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.sanctuary_profiles"), /permission denied/);
    await assert.rejects(db.query("select * from public.sanctuary_tributes"), /permission denied/);
    await assert.rejects(db.query(TRIBUTE, [OWNER, GUEST, "spark", "anonymous"]), /permission denied/);

    // 15. No policy on the new tables is exposed to anon or to the implicit public role.
    await db.exec("reset role");
    const policies = await db.query<{ policyname: string; roles: string }>(
      "select policyname, array_to_string(roles, ',') as roles from pg_policies where schemaname='public' and tablename like 'sanctuary%'");
    assert.equal(policies.rows.length, 9);
    for (const row of policies.rows) assert.doesNotMatch(row.roles, /anon|\bpublic\b/, row.policyname);
  } finally {
    await db.close();
  }
});

test("sanctuary migration leaves the existing privacy guarantees untouched", () => {
  const migration = read("supabase/migrations/20260920120000_sanctuary_and_chapters.sql");
  // Opt-in publication default.
  assert.match(migration, /is_public boolean not null default false/);
  // Explicit grants rather than inherited ones, mirroring wechat_login.
  assert.match(migration, /revoke all on public\.sanctuary_profiles from public, anon, authenticated, service_role/);
  assert.match(migration, /revoke all on public\.sanctuary_tribute_limits from public, anon, authenticated, service_role/);
  // Column level grants keep the counter and the signature out of client reach.
  assert.match(migration, /grant insert \(user_id, epitaph, creed_1, creed_2, creed_3, is_public\)/);
  assert.match(migration, /grant insert \(id, target_user_id, guest_user_id, tribute_kind, message\)/);
  assert.doesNotMatch(migration, /grant (insert|update) \([^)]*tribute_count/);
  assert.doesNotMatch(migration, /grant (insert|update) \([^)]*guest_name/);
  // Every policy names a role, so none of them silently applies to anon.
  for (const policy of migration.matchAll(/create policy[^;]+;/g)) assert.match(policy[0], /to authenticated/);
  // A definer body is pinned, and no capsule schema duplicates public.future_letters.
  assert.match(migration, /security definer set search_path = ''/);
  assert.doesNotMatch(migration, /capsule_ciphertext|capsule_target_date/);
  assert.match(migration, /public\.future_letters/);
});

test("the granted columns accept the PATCH-then-INSERT save and refuse a PostgREST upsert", async () => {
  const db = new PGlite();
  try {
    await db.exec(BOOTSTRAP);
    await db.exec(read("supabase/migrations/20260920120000_sanctuary_and_chapters.sql"));
    await db.exec(asUser(OWNER));

    // `Prefer: resolution=merge-duplicates` also emits `user_id = excluded.user_id` inside
    // DO UPDATE SET. No UPDATE grant covers user_id, so PostgREST answers 403 and the whole
    // save fails. This is the regression guard for that: the client must PATCH, then INSERT.
    await assert.rejects(db.query(
      `insert into public.sanctuary_profiles (user_id, epitaph, creed_1, creed_2, creed_3, is_public)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id) do update set user_id = excluded.user_id, epitaph = excluded.epitaph,
         creed_1 = excluded.creed_1, creed_2 = excluded.creed_2, creed_3 = excluded.creed_3,
         is_public = excluded.is_public`,
      [OWNER, "A", "", "", "", false]), /permission denied/);

    // A PATCH that matches nothing reports zero rows rather than raising, which is what
    // makes it a usable existence probe in utils/supabase.js.
    const before = await db.query(
      "update public.sanctuary_profiles set epitaph=$1 where user_id=$2 returning *", ["A", OWNER]);
    assert.equal(before.rows.length, 0);

    const created = await db.query<{ is_public: boolean }>(
      `insert into public.sanctuary_profiles (user_id, epitaph, creed_1, creed_2, creed_3, is_public)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [OWNER, "A", "", "", "", false]);
    assert.equal(created.rows[0].is_public, false);

    // Pin updated_at a day into the past. No client role can write that column, so if the
    // edit below leaves it old, the trigger did not fire.
    await db.exec("reset role");
    await db.query("update public.sanctuary_profiles set updated_at = now() - interval '1 day' where user_id=$1", [OWNER]);
    await db.exec(asUser(OWNER));

    const updated = await db.query<{ epitaph: string; tribute_count: number; updated_at: Date }>(
      "update public.sanctuary_profiles set epitaph=$1, creed_1=$2, is_public=$3 where user_id=$4 returning *",
      ["B", "c1", true, OWNER]);
    assert.equal(updated.rows.length, 1, "the second save must take the update path");
    assert.equal(updated.rows[0].epitaph, "B");
    assert.equal(updated.rows[0].tribute_count, 0, "an edit never touches the server owned counter");
    assert.ok(new Date(updated.rows[0].updated_at).getTime() > Date.now() - 60000, "the trigger refreshed updated_at");

    // user_id must stay unwritable, which is what makes the refusal above a guarantee
    // rather than an accident of the grant list.
    await assert.rejects(
      db.query("update public.sanctuary_profiles set user_id=$1 where user_id=$2", [GUEST, OWNER]),
      /permission denied/);
  } finally {
    await db.close();
  }
});
