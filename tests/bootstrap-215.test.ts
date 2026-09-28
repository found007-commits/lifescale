import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  absoluteMediaUrl,
  CHECKIN_LIMIT,
  ENTRY_LIMIT,
  isSignableImage,
  isWechatOnlyAccount,
  loadDashboardBootstrap,
  type BootstrapEntry,
  type BootstrapReads,
  type BootstrapRow,
} from "../lib/dashboard-bootstrap";

const requireMini = createRequire(import.meta.url);
// The device-side rule this must agree with. Both are simple enough to rewrite by hand, and
// that is exactly why this comparison exists.
const miniPolicy = requireMini("../miniprogram/utils/setup-policy.js");

const BASE = "https://synthetic.supabase.co";
const PROFILE = { id: "user-1", onboarding_completed: true, birth_date: "1990-01-01", target_age: 88 };
const WECHAT_EMAIL = "2130000000@wechat.lifescale.invalid";

const ENTRIES: BootstrapEntry[] = [{
  id: "entry-1",
  entry_date: "2026-09-27",
  content: "今天走了很远的路",
  entry_media: [
    { id: "media-2", storage_path: "user-1/entry-1/b.jpg", media_type: "image/jpeg", created_at: "2026-09-27T10:00:00.000Z" },
    { id: "media-1", storage_path: "user-1/entry-1/a.jpg", media_type: "image/jpeg", created_at: "2026-09-27T09:00:00.000Z" },
    { id: "media-3", storage_path: "user-1/entry-1/v.mp4", media_type: "video/mp4", created_at: "2026-09-27T11:00:00.000Z" },
    { id: "media-4", storage_path: "user-1/entry-1/g.gif", media_type: "image/gif", created_at: "2026-09-27T12:00:00.000Z" },
  ],
}];

function synthetic(profileResult: BootstrapRow | null = PROFILE) {
  const calls: string[] = [];
  let signed: string[] = [];
  const reads: BootstrapReads = {
    profile: async userId => { calls.push(`profile:${userId}`); return profileResult; },
    entries: async (userId, limit) => { calls.push(`entries:${userId}:${limit}`); return ENTRIES; },
    checkins: async (userId, limit) => { calls.push(`checkins:${userId}:${limit}`); return [{ id: "c1", checkin_date: "2026-09-27" }]; },
    checkinCount: async userId => { calls.push(`count:${userId}`); return 42; },
    signMedia: async (paths, expiresIn) => {
      calls.push(`sign:${expiresIn}`);
      signed = paths;
      return paths.map(path => ({ path, signedUrl: `/object/sign/entry-media/${path}?token=synthetic` }));
    },
  };
  return { reads, calls, signedPaths: () => signed };
}

test("a WeChat account without a finished profile gets no record read at all", async () => {
  const { reads, calls } = synthetic(null);
  const payload = await loadDashboardBootstrap("user-1", WECHAT_EMAIL, reads, BASE);
  assert.deepEqual(calls, ["profile:user-1"], "entries, check-ins and signing must never run");
  assert.deepEqual(payload, { profile: null, setupRequired: true, entries: [], checkins: [], checkinCount: 0 });
});

test("the same gate holds when a profile row exists but setup was never completed", async () => {
  const { reads, calls } = synthetic({ id: "user-1", onboarding_completed: false });
  const payload = await loadDashboardBootstrap("user-1", WECHAT_EMAIL, reads, BASE);
  assert.equal(payload.setupRequired, true);
  assert.deepEqual(calls, ["profile:user-1"]);
});

test("a finished profile gets the dashboard in one payload, with only still photos signed", async () => {
  const { reads, calls, signedPaths } = synthetic();
  const payload = await loadDashboardBootstrap("user-1", WECHAT_EMAIL, reads, BASE);
  assert.equal(payload.setupRequired, false);
  assert.deepEqual(payload.checkins, [{ id: "c1", checkin_date: "2026-09-27" }]);
  assert.equal(payload.checkinCount, 42);
  // every read stays scoped to the caller and limited the way the page expects; the three
  // record reads run together, so their order is not part of the contract
  assert.deepEqual([...calls].sort(), ["count:user-1", `entries:user-1:${ENTRY_LIMIT}`, `checkins:user-1:${CHECKIN_LIMIT}`, "profile:user-1", "sign:3600"].sort());
  assert.deepEqual([...signedPaths()].sort(), ["user-1/entry-1/a.jpg", "user-1/entry-1/b.jpg"]);

  const [first] = payload.entries;
  const media = first.entry_media ?? [];
  assert.deepEqual(media.map(item => item.id), ["media-1", "media-2", "media-3", "media-4"]);
  assert.equal(media[0].signed_url, `${BASE}/storage/v1/object/sign/entry-media/user-1/entry-1/a.jpg?token=synthetic`);
  assert.equal(media[2].signed_url, "", "a video keeps its placeholder instead of a signed download");
  assert.equal(media[3].signed_url, "", "a GIF is not handed to the image decoder either");
});

test("an account with its own email is never pushed through WeChat setup", async () => {
  const { reads, calls } = synthetic(null);
  const payload = await loadDashboardBootstrap("user-1", "reader@example.invalid", reads, BASE);
  assert.equal(payload.setupRequired, false);
  assert.ok(calls.includes("entries:user-1:3"), "an email account may read without completing setup, as before");
});

test("only URLs that resolve inside our own storage are handed back", () => {
  // Every shape storage returns must land on the same absolute URL, and a URL that points
  // anywhere else must not survive — nothing here trusts a host we do not own.
  const absolute = `${BASE}/storage/v1/object/sign/entry-media/user-1/entry-1/a.jpg?token=synthetic`;
  assert.equal(absoluteMediaUrl("/object/sign/entry-media/user-1/entry-1/a.jpg?token=synthetic", BASE), absolute);
  assert.equal(absoluteMediaUrl("/storage/v1/object/sign/entry-media/user-1/entry-1/a.jpg?token=synthetic", BASE), absolute);
  assert.equal(absoluteMediaUrl(absolute, BASE), absolute);
  assert.equal(absoluteMediaUrl("https://elsewhere.invalid/object/sign/entry-media/a.jpg", BASE), "");
  assert.equal(absoluteMediaUrl("", BASE), "");
  assert.equal(absoluteMediaUrl(absolute, ""), "", "without a project URL there is nothing to trust");
});

test("the signed-URL helper keeps exactly still images", () => {
  assert.equal(isSignableImage({ id: "i", storage_path: "p", media_type: "image/jpeg" }), true);
  assert.equal(isSignableImage({ id: "i", storage_path: "p", media_type: "video/mp4" }), false);
  assert.equal(isSignableImage({ id: "i", storage_path: "p", media_type: "image/gif" }), false);
});

test("the server decides who is a WeChat-only account exactly as the device does", () => {
  // The device-side helper is the one this replaces; if it is renamed, this comparison
  // silently stops meaning anything, so ask for it by name.
  assert.equal(typeof miniPolicy.isWechatOnly, "function");
  assert.equal(typeof miniPolicy.requiresWechatSetup, "function");
  const cases = [WECHAT_EMAIL, WECHAT_EMAIL.toUpperCase(), undefined, null, "", "reader@example.invalid", "x@wechat.lifescale.invalid.example"];
  for (const email of cases) {
    assert.equal(
      isWechatOnlyAccount(email),
      miniPolicy.isWechatOnly({ user: { id: "user-1", email } }),
      `disagreement for ${String(email)}`,
    );
  }
  // The composite rule is duplicated nowhere: the device keeps deciding it from the bundle.
  assert.equal(miniPolicy.requiresWechatSetup({ user: { id: "user-1", email: WECHAT_EMAIL } }, { id: "user-1", onboarding_completed: true }), false);
  assert.equal(miniPolicy.requiresWechatSetup({ user: { id: "user-1", email: WECHAT_EMAIL } }, null), true);
});
