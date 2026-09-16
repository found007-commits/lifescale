import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
const migration=readFileSync(new URL("../supabase/migrations/20260913100000_one_time_entry_edit.sql",import.meta.url),"utf8");
test("one-time edit is enforced in Postgres: old rows, no-op, rollback, retries, owner isolation and direct REST bypass",async()=>{
  const db=new PGlite();
  const u="00000000-0000-0000-0000-000000000001",v="00000000-0000-0000-0000-000000000002";
  const e="10000000-0000-0000-0000-000000000001",empty="10000000-0000-0000-0000-000000000002",other="10000000-0000-0000-0000-000000000003";
  const req="20000000-0000-0000-0000-000000000001",req2="20000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
      grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
      create type public.entry_mood as enum('calm','happy');create type public.entry_category as enum('daily','work');
      create table public.life_entries(id uuid primary key,user_id uuid,content text check(char_length(content)<=12000),mood public.entry_mood default 'calm',category public.entry_category default 'daily',entry_date timestamptz default now(),created_at timestamptz default now(),updated_at timestamptz default now(),visibility text default 'private' check(visibility='private'));
      create table public.entry_media(entry_id uuid);
      insert into public.life_entries(id,user_id,content) values('${e}','${u}','Original'),('${empty}','${u}','Keep text'),('${other}','${v}','Other');
      alter table public.life_entries enable row level security;
      grant select,insert,update,delete on public.life_entries to authenticated;grant select on public.entry_media to authenticated;
      create policy owner on public.life_entries for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    `);
    await db.exec(migration);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${u}'`);
    const edit=(id:string,text:string,requestId=req)=>db.query<{edit_count:number;content:string;edited_at:string|null}>("select * from public.edit_private_entry_once($1,$2,'calm','daily',$3)",[id,text,requestId]);
    assert.equal((await edit(e,"Original")).rows[0].edit_count,0);
    await assert.rejects(edit(empty,""),/ENTRY_CONTENT_REQUIRED/);
    assert.equal((await db.query<{edit_count:number}>("select edit_count from public.life_entries where id=$1",[empty])).rows[0].edit_count,0);
    await db.exec("begin");await edit(e,"Rolled back");await db.exec("rollback");
    assert.equal((await db.query<{edit_count:number}>("select edit_count from public.life_entries where id=$1",[e])).rows[0].edit_count,0);
    const saved=(await edit(e,"Revised")).rows[0];assert.equal(saved.edit_count,1);assert.ok(saved.edited_at);
    assert.equal((await edit(e,"Revised")).rows[0].content,"Revised");
    await assert.rejects(edit(e,"Another change"),/ENTRY_EDIT_ALREADY_USED/);
    await assert.rejects(edit(e,"Revised",req2),/ENTRY_EDIT_ALREADY_USED/);
    await assert.rejects(db.query("update public.life_entries set edit_count=0 where id=$1",[e]),/ENTRY_EDIT_COUNTER_IMMUTABLE/);
    await assert.rejects(db.query("update public.life_entries set content='REST bypass' where id=$1",[e]),/ENTRY_EDIT_ALREADY_USED/);
    await assert.rejects(db.query("update public.life_entries set edited_at=null where id=$1",[e]),/ENTRY_EDIT_COUNTER_IMMUTABLE/);
    await assert.rejects(db.query("update public.life_entries set entry_date=now()+interval '1 day' where id=$1",[e]),/ENTRY_IDENTITY_IMMUTABLE/);
    await assert.rejects(edit(other,"Intrusion"),/ENTRY_NOT_FOUND/);
    await db.exec(`reset role; insert into public.entry_media values('${empty}');set role authenticated`);
    assert.equal((await edit(empty,"")).rows[0].edit_count,1); // Media-only remains valid.
    await db.exec("reset role;set role anon");await assert.rejects(edit(e,"Anon"),/permission denied/);
    await db.exec("reset role");
    // Column defaults give all pre-existing entries exactly one opportunity.
    assert.equal((await db.query<{edit_count:number}>("select edit_count from public.life_entries where id=$1",[other])).rows[0].edit_count,0);
  } finally {await db.close();}
});
