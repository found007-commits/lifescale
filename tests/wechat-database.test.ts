import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("actual Postgres migration enforces private unique bindings, rate limits, recovery and deletion cascade", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to service_role, anon, authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001','old@example.invalid','{}'),
        ('00000000-0000-0000-0000-000000000002','other@example.invalid','{}');
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20260908170000_wechat_login.sql", import.meta.url), "utf8"));
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const sql of ["select * from public.wechat_identities", "select * from public.wechat_auth_limits", "select public.wechat_auth_allow('x',1,60)", "select public.wechat_reserved_user('x')", "delete from public.wechat_identities"]) {
        await assert.rejects(db.query(sql), /permission denied/);
      }
      await db.exec("reset role");
    }
    const subject = "a".repeat(64);
    await db.exec("set role service_role");
    await db.query("insert into public.wechat_identities(app_id,subject_hash,user_id) values ('app',$1,'00000000-0000-0000-0000-000000000001')", [subject]);
    await assert.rejects(db.query("insert into public.wechat_identities(app_id,subject_hash,user_id) values ('app',$1,'00000000-0000-0000-0000-000000000002')", [subject]), /duplicate key/);
    await assert.rejects(db.query("insert into public.wechat_identities(app_id,subject_hash,user_id) values ('app',$1,'00000000-0000-0000-0000-000000000001')", ["b".repeat(64)]), /duplicate key/);
    await assert.rejects(db.exec("update public.wechat_identities set app_id='other'"), /permission denied/);
    for (const expected of [true, true, false]) assert.equal((await db.query<{ok:boolean}>("select public.wechat_auth_allow('test',2,60) as ok")).rows[0].ok, expected);
    assert.equal((await db.query<{ok:boolean}>("select public.wechat_auth_allow('test-invalid',0,60) as ok")).rows[0].ok, false);
    await db.exec("reset role; update public.wechat_auth_limits set expires_at=now()-interval '1 second'; set role service_role;");
    assert.equal((await db.query<{ok:boolean}>("select public.wechat_auth_allow('test',2,60) as ok")).rows[0].ok, true);
    await db.exec("reset role");
    await db.query("insert into auth.users values ('00000000-0000-0000-0000-000000000003',$1,$2)", [subject+"@wechat.lifescale.invalid", JSON.stringify({lifescale_wechat_subject:subject})]);
    await db.exec("set role service_role");
    assert.equal((await db.query<{id:string}>("select public.wechat_reserved_user($1) as id",[subject])).rows[0].id,"00000000-0000-0000-0000-000000000003");
    await db.exec("reset role; delete from auth.users where id='00000000-0000-0000-0000-000000000001'");
    assert.equal((await db.query("select * from public.wechat_identities")).rows.length, 0);
  } finally { await db.close(); }
});
