import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { prepareMedia, MAX_MEDIA_BYTES } from "../lib/prepare-media";
const require = createRequire(import.meta.url);
const read = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("GIF bytes survive upload preparation and videos are not decoded into canvas", async () => {
  const gif = new File(["GIF89a", new Uint8Array(80)], "a.gif", { type: "image/gif" });
  const result = await prepareMedia(gif);
  assert.equal(result.type, "image/gif");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(await gif.arrayBuffer()));
  const video = new File([new Uint8Array([0,0,0,24]), "ftypisom", new Uint8Array(80)], "clip.mp4", { type: "video/mp4" });
  const prepared = await prepareMedia(video);
  assert.equal(prepared.type, "video/mp4"); assert.equal(prepared.size, video.size);
  await assert.rejects(prepareMedia(new File(["not a video"], "fake.mp4", {type:"video/mp4"})), /MP4/);
  const huge = { name:"huge.mp4", type:"video/mp4", size: MAX_MEDIA_BYTES + 1, slice: () => video.slice(0,12) } as File;
  await assert.rejects(prepareMedia(huge), /50 MB/);
});

test("mini preserves GIF animation without invoking image optimization", async () => {
  const moduleStub = {exports: {} as {prepareMedia: (canvas: unknown, file: unknown) => Promise<{mediaType: string;size:number}>}};
  let optimized=0, copied=0;
  vm.runInNewContext(read("miniprogram/utils/prepare-media.js"), {
    module:moduleStub, Uint8Array,
    require: (path: string) => path === "./prepare-image" ? {prepareImage: () => {optimized++;}} : require("../miniprogram/utils/" + path.split("/").pop() + ".js"),
    wx: {env:{USER_DATA_PATH:"/synthetic"},getFileSystemManager:()=>({
      readFile:(o:{success:(value:unknown)=>void})=>o.success({data:new TextEncoder().encode("GIF89a1234567").buffer}),
      stat:(o:{success:(value:unknown)=>void})=>o.success({stats:{size:4096}}),
      copyFile:(o:{success:(value:unknown)=>void})=>{copied++;o.success({});},
    })},
  });
  const result=await moduleStub.exports.prepareMedia(null,{path:"/original.gif",name:"original.gif"});
  assert.equal(result.mediaType,"image/gif");assert.equal(result.size,4096);assert.equal(optimized,0);assert.equal(copied,1);
});

test("media and note migration enforces ownership, same-entry replies, limits and cascades in Postgres", async () => {
  const db = new PGlite();
  const owner="00000000-0000-0000-0000-000000000001", other="00000000-0000-0000-0000-000000000002";
  const entry="10000000-0000-0000-0000-000000000001", second="10000000-0000-0000-0000-000000000002", foreign="10000000-0000-0000-0000-000000000003";
  const note="20000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;
      create table public.life_entries(id uuid primary key,user_id uuid references auth.users(id),visibility text default 'private' check(visibility='private'));
      create table public.entry_media(id uuid primary key,entry_id uuid references public.life_entries(id),user_id uuid references auth.users(id),storage_path text,media_type text constraint entry_media_media_type_check check(media_type like 'image/%'));
      create table storage.buckets(id text primary key,file_size_limit bigint,allowed_mime_types text[]);
      insert into storage.buckets(id) values ('entry-media');
      insert into auth.users values ('${owner}'),('${other}');
      insert into public.life_entries(id,user_id) values ('${entry}','${owner}'),('${second}','${owner}'),('${foreign}','${other}');
      alter table public.life_entries enable row level security; alter table public.entry_media enable row level security;
      grant select,insert,delete on public.life_entries,public.entry_media to authenticated;
      create policy entries_own on public.life_entries for all to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
    `);
    await db.exec(read("supabase/migrations/20260913090000_media_and_private_comments.sql"));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`);
    await db.query("insert into public.entry_comments(id,entry_id,user_id,content) values ($1,$2,$3,'A note')", [note,entry,owner]);
    await db.query("insert into public.entry_comments(entry_id,user_id,parent_id,content) values ($1,$2,$3,'A reply')", [entry,owner,note]);
    await assert.rejects(db.query("insert into public.entry_comments(entry_id,user_id,parent_id,content) values ($1,$2,$3,'Wrong entry')",[second,owner,note]), /foreign key/);
    await assert.rejects(db.query("insert into public.entry_comments(entry_id,user_id,content) values ($1,$2,'Not mine')",[foreign,owner]), /row-level security/);
    await assert.rejects(db.query("insert into public.entry_comments(entry_id,user_id,content) values ($1,$2,'   ')",[entry,owner]), /check constraint/);
    await assert.rejects(db.query("insert into public.entry_comments(entry_id,user_id,content) values ($1,$2,$3)",[entry,owner,"a".repeat(2001)]), /check constraint/);
    await assert.rejects(db.exec("update public.entry_comments set content='tamper'"), /permission denied/);
    await db.query("insert into public.entry_media values(gen_random_uuid(),$1,$2,$3,'video/mp4')",[entry,owner,`${owner}/${entry}/clip.mp4`]);
    await assert.rejects(db.query("insert into public.entry_media values(gen_random_uuid(),$1,$2,$3,'video/mp4')",[foreign,owner,`${owner}/${foreign}/clip.mp4`]), /row-level security/);
    await db.exec(`set request.jwt.claim.sub='${other}'`);
    assert.equal((await db.query("select * from public.entry_comments")).rows.length,0);
    await assert.rejects(db.query("insert into public.entry_comments(entry_id,user_id,content) values ($1,$2,'Forged')",[entry,owner]), /row-level security/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.entry_comments"), /permission denied/);
    await db.exec("reset role");
    await db.query("delete from public.entry_comments where id=$1",[note]);
    assert.equal((await db.query("select * from public.entry_comments")).rows.length,0);
    await assert.rejects(db.exec("update public.life_entries set visibility='public'"), /check constraint/);
    assert.equal((await db.query<{file_size_limit:number}>("select file_size_limit from storage.buckets")).rows[0].file_size_limit,52428800);
  } finally { await db.close(); }
});

test("lists never put video or GIF URLs into media sources; detail video is user-triggered", () => {
  for (const page of ["history","dashboard"]) {
    const wxml=read(`miniprogram/pages/${page}/${page}.wxml`);
    assert.match(wxml,/media.kind === 'image' && media.signed_url/);
    assert.match(wxml,/wx:for-index="mediaIndex"/);
    assert.doesNotMatch(wxml,/<video/);
  }
  const detail=read("miniprogram/pages/entry/entry.wxml");
  assert.match(detail,/item.kind === 'video' && item.active/);assert.match(detail,/autoplay="\{\{false\}\}"/);
  assert.match(read("app/components/MediaViewer.tsx"),/preload="metadata"/); // Player is mounted only after opening a card.
  assert.doesNotMatch(read("app/components/MediaViewer.tsx"), /autoPlay/);
  assert.match(read("miniprogram/pages/history/history.js"),/getEntries\(session.user.id, 20/);
});
