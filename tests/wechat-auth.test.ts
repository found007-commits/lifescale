import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleWechatAuth, wechatStatus, WechatAuthError, hash, type AuthUser, type WechatAuthDependencies, type LoginSession } from "../lib/wechat-auth-core";

function harness() {
  const users = new Map<string, AuthUser>([["original", { id: "original", email: "old@example.invalid", email_confirmed_at: "2026-01-01" }], ["other", { id: "other", email: "other@example.invalid", email_confirmed_at: "2026-01-01" }]]);
  const links = new Map<string, string>(), counts = new Map<string, number>();
  const calls = { create: 0, issue: [] as string[], exchange: 0, verify: 0 };
  const session = (id: string): LoginSession => ({ access_token: "test-access-" + id, refresh_token: "test-refresh-" + id, expires_in: 3600, token_type: "bearer", user: users.get(id)! });
  const deps: WechatAuthDependencies = {
    enabled: true,
    async allow(bucket, limit) { const count = (counts.get(bucket) || 0) + 1; counts.set(bucket, count); return count <= limit; },
    async exchange() { calls.exchange++; return "subject"; },
    async findIdentity(subject) { return links.get(subject) || null; },
    async isBound(id) { return [...links.values()].includes(id); },
    async authenticate(token) { return users.get(token) || null; },
    async verifyEmail(email, otp) { calls.verify++; if (otp !== "123456") throw new WechatAuthError("EMAIL_VERIFY_FAILED", 401); const user = [...users.values()].find(u => u.email === email); if (!user) throw new WechatAuthError("EMAIL_VERIFY_FAILED", 401); return session(user.id); },
    async createUser() { calls.create++; const user = { id: "new", email: "subject@wechat.lifescale.invalid" }; users.set("new", user); return user; },
    async link(subject, id) { if (links.has(subject)) return links.get(subject) === id; if ([...links.values()].includes(id)) return false; links.set(subject, id); return true; },
    async unlink(id) { for (const [subject, owner] of links) if (owner === id) links.delete(subject); },
    async issueSession(id) { calls.issue.push(id); return session(id); },
  };
  let sequence = 0;
  const run = (data: Record<string, unknown> = {}, bearer: string | null = null) => handleWechatAuth({ action: "login", code: "code-" + sequence++, agreed: true, ...data }, bearer, "synthetic-ip", deps);
  return { deps, run, calls, users, links, counts, session };
}
test("unbound WeChat never silently creates an empty account", async () => {
  const h = harness();
  assert.deepEqual(await h.run({ user_id: "original", openid: "forged" }), { needsAccountChoice: true });
  assert.equal(h.calls.create, 0); assert.equal(h.calls.issue.length, 0);
  await assert.rejects(h.run({ action: "create" }), { code: "NEW_ACCOUNT_CONFIRM_REQUIRED" });
  assert.equal(h.users.size, 2);
});
test("verified original email binds to the same user ID; subsequent WeChat login returns that account", async () => {
  const h = harness();
  const before = JSON.stringify([...h.users]);
  const result = await h.run({ action: "bind", email: " OLD@example.invalid ", otp: "123456", user_id: "other" });
  assert.equal(result.session?.user.id, "original"); assert.equal(h.links.get("subject"), "original");
  assert.equal((await h.run()).session?.user.id, "original");
  assert.equal(h.calls.create, 0); assert.equal(JSON.stringify([...h.users]), before);
});
test("binding conflicts never reassign identities and only return the verified email account", async () => {
  const h = harness(); h.links.set("subject", "other");
  const result = await h.run({ action: "bind", email: "old@example.invalid", otp: "123456" });
  assert.equal(result.bindingConflict, true); assert.equal(result.session?.user.id, "original");
  assert.equal(h.links.get("subject"), "other"); assert.equal(h.calls.issue.length, 0);
  h.links.clear(); h.links.set("another-wechat", "original");
  assert.equal((await h.run({ action: "bind", email: "old@example.invalid", otp: "123456" })).bindingConflict, true);
  assert.equal(h.links.has("subject"), false);
});
test("invalid email code and signed-in account mismatch cannot create a binding", async () => {
  const h = harness();
  await assert.rejects(h.run({ action: "bind", email: "old@example.invalid", otp: "000000" }), { code: "EMAIL_VERIFY_FAILED" });
  await assert.rejects(h.run({ action: "bind", email: "old@example.invalid", otp: "123456" }, "other"), { code: "ACCOUNT_MISMATCH" });
  assert.equal(h.links.size, 0); assert.equal(h.calls.create, 0);
});
test("disabled service, missing consent, invalid actions and replay fail before identity exchange", async () => {
  const h = harness(); h.deps.enabled = false;
  await assert.rejects(h.run(), { code: "WECHAT_UNAVAILABLE" }); h.deps.enabled = true;
  await assert.rejects(h.run({ agreed: false }), { code: "CONSENT_REQUIRED" });
  await assert.rejects(h.run({ action: "overwrite" }), { code: "INVALID_REQUEST" });
  assert.equal(h.calls.exchange, 0);
  await h.run({ code: "single-use" });
  await assert.rejects(h.run({ code: "single-use" }), { code: "WECHAT_CODE_EXPIRED" });
  assert.equal(h.calls.exchange, 1);
});
test("new accounts require explicit confirmation; concurrent mapping winner remains canonical", async () => {
  const h = harness();
  assert.equal((await h.run({ action: "create", newAccountConfirmed: true })).session?.user.id, "new");
  assert.equal((await h.run({ action: "create", newAccountConfirmed: true })).session?.user.id, "new");
  assert.equal(h.calls.create, 1);
  const race = harness(); race.deps.createUser = async () => { race.links.set("subject", "original"); return { id: "new" }; };
  assert.equal((await race.run({ action: "create", newAccountConfirmed: true })).session?.user.id, "original");
  assert.deepEqual(race.calls.issue, ["original"]);
});
test("unlink requires a current session plus fresh verification of its own email", async () => {
  const h = harness(); h.links.set("subject", "original");
  const body = { action: "unbind", email: "old@example.invalid", otp: "123456" };
  await assert.rejects(h.run(body), { code: "UNAUTHORIZED" });
  await assert.rejects(h.run({ ...body, email: "other@example.invalid" }, "original"), { code: "ACCOUNT_MISMATCH" });
  await assert.rejects(h.run({ ...body, otp: "000000" }, "original"), { code: "EMAIL_VERIFY_FAILED" });
  assert.equal(h.links.size, 1);
  const result = await h.run(body, "original");
  assert.equal(result.unbound, true); assert.equal(result.session?.user.id, "original"); assert.equal(h.links.size, 0);
  assert.equal(h.calls.exchange, 0);
});
test("only login method cannot be removed, MFA cannot be bypassed, status is authenticated", async () => {
  const h = harness(); h.users.set("new", { id: "new", email: "subject@wechat.lifescale.invalid" });
  await assert.rejects(h.run({ action: "unbind" }, "new"), { code: "LAST_LOGIN_METHOD" });
  await assert.rejects(wechatStatus("bad", h.deps), { code: "UNAUTHORIZED" });
  assert.equal((await wechatStatus("new", h.deps)).canUnbind, false);
  h.users.get("original")!.factors = [{ status: "verified" }]; h.links.set("subject", "original");
  await assert.rejects(h.run(), { code: "USE_EMAIL_LOGIN" });
});
test("rate limiting, session user mismatch and changed mapping fail closed", async () => {
  const h = harness(); h.deps.allow = async () => false;
  await assert.rejects(h.run(), { code: "TRY_LATER" }); assert.equal(h.calls.exchange, 0);
  const mismatch = harness(); mismatch.links.set("subject", "original"); mismatch.deps.issueSession = async () => mismatch.session("other");
  await assert.rejects(mismatch.run(), { code: "SESSION_MISMATCH" });
  const changed = harness(); changed.links.set("subject", "original"); changed.deps.issueSession = async () => { changed.links.delete("subject"); return changed.session("original"); };
  await assert.rejects(changed.run(), { code: "LOGIN_RETRY" });
});
test("mapping tables have no client access, no UPDATE grants, and cascade on account deletion", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260908170000_wechat_login.sql", import.meta.url), "utf8");
  assert.match(sql, /references auth.users\(id\) on delete cascade/);
  assert.match(sql, /unique \(app_id, user_id\)/);
  assert.match(sql, /revoke all on public.wechat_identities from public, anon, authenticated/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /grant[^;]*update|update public\.(profiles|life_entries|entry_media)/i);
  assert.match(sql, /raw_app_meta_data/);
  assert.equal(hash("test-only").length, 64);
});
