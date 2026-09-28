import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const read = name => readFileSync(new URL("../miniprogram/" + name, import.meta.url), "utf8");
const { localDateString } = require("../miniprogram/utils/life.js");
const freshness = require("../miniprogram/utils/data-freshness.js");

const TODAY = localDateString();
const PROFILE = { id: "owner", onboarding_completed: true, birth_date: "1990-01-01", target_age: 88, locale: "zh", display_mode: "gentle", timezone: "Asia/Shanghai" };
const ENTRY = { id: "entry-1", entry_date: TODAY, content: "今天走了很远的路", mood: "calm", category: "daily", created_at: "2026-09-27", entry_media: [] };
const CHECKINS = [{ id: "checkin-1", checkin_date: TODAY }];

function section(title) {
  const bundle = { userId: "owner", profile: PROFILE, setupRequired: false, entries: [ENTRY], checkins: CHECKINS, checkinCount: 4 };
  return { title, bundle };
}

const { bootstrapUnsupported } = require("../miniprogram/utils/supabase.js");

// The dashboard page, with every API it asks for supplied by the test. `app` can carry a
// launch-time bundle the way app.js would leave it.
function dashboard(api = {}, options = {}) {
  let page;
  const calls = [];
  const session = options.session || { user: { id: "owner", email: "owner@example.invalid" }, access_token: "synthetic" };
  const app = options.app || { globalData: { locale: "zh", profile: null } };
  const context = {
    console,
    setTimeout: () => 1,
    getApp: () => app,
    getCurrentPages: () => [],
    wx: {
      getStorageSync: () => null,
      removeStorageSync: () => {},
      stopPullDownRefresh() {},
      showToast() {},
      navigateTo: o => calls.push(o),
      reLaunch: o => calls.push(o),
      switchTab: o => calls.push(o),
      navigateBack: () => calls.push({ back: true }),
    },
    require(path) {
      if (path.endsWith("localized-page")) return value => { page = value; };
      // bootstrapUnsupported is the module's own helper, so the page is tested against the
      // same rule that ships with it.
      if (path.endsWith("supabase")) return { requireSession: () => session, restoreSession: () => session, bootstrapUnsupported, ...api };
      return require("../miniprogram/utils/" + path.split("/").pop() + ".js");
    },
  };
  vm.runInNewContext(read("pages/dashboard/dashboard.js"), context);
  page.setData = function (values) { Object.assign(this.data, values); };
  return { page, app, calls };
}

function offline(mark) {
  return async () => { throw new Error(`the per-read path must not run: ${mark}`); };
}

test("the first paint is one request: nothing is read one table at a time", async () => {
  const { bundle } = section("done");
  let asks = 0;
  const h = dashboard({ bootstrapDashboard: async () => { asks++; return bundle; }, getProfile: offline("getProfile"), getEntries: offline("getEntries") });
  await h.page.load();
  assert.equal(asks, 1);
  assert.equal(h.page.data.error, "");
  assert.equal(h.page.data.profile.id, "owner");
  assert.ok(h.page.data.metrics?.displayDaysText, "the life scale must be computed from the returned profile");
  assert.equal(h.page.data.recentEntries.length, 1);
  assert.equal(h.page.data.checkinCount, 4);
  assert.equal(h.page.data.checkedToday, true);
  assert.equal(h.page.data.loading, false);
});

test("a WeChat account that has not finished setup is sent to onboarding and nothing is read", async () => {
  let asks = 0, reads = 0;
  const h = dashboard({
    bootstrapDashboard: async () => { asks++; return { userId: "owner", profile: null, setupRequired: true, entries: [], checkins: [], checkinCount: 0 }; },
    getEntries: async () => { reads++; return []; },
  });
  await h.page.load();
  assert.equal(asks, 1);
  assert.equal(reads, 0);
  assert.equal(h.page.data.recentEntries.length, 0);
  assert.equal(h.calls[0].url, "/pages/onboarding/onboarding?required=1");
  // The stronger half of this rule lives on the server: it must not even look at records for
  // such an account. See bootstrap-215.test.ts, "gets no record read at all".
});

test("a server without the merged endpoint falls back to reading one thing at a time", async () => {
  const missing = Object.assign(new Error("page not found"), { status: 404 });
  const h = dashboard({
    bootstrapDashboard: async () => { throw missing; },
    getProfile: async () => PROFILE,
    getEntries: async (userId, limit) => { assert.equal(limit, 3); return [ENTRY]; },
    getCheckins: async (userId, limit) => { assert.equal(limit, 7); return CHECKINS; },
    getCheckinCount: async () => 9,
  });
  await h.page.load();
  assert.equal(h.page.data.error, "", "an older server must not look like a failure to the reader");
  assert.equal(h.page.data.recentEntries.length, 1);
  assert.equal(h.page.data.checkinCount, 9);
});

test("a failure that is not 'no such endpoint' is shown to the reader, not swallowed", async () => {
  const h = dashboard({
    bootstrapDashboard: async () => { throw new Error("今天打不开了。"); },
    getProfile: offline("getProfile"),
  });
  await h.page.load();
  assert.equal(h.page.data.error, "今天打不开了。");
  assert.equal(h.page.data.loading, false);
});

test("the request started at launch is reused once, and only for its own account", async () => {
  const { bundle } = section("done");
  let asks = 0;
  const app = { globalData: { locale: "zh", profile: null }, dashboardBootstrap: Promise.resolve(bundle) };
  const h = dashboard({ bootstrapDashboard: async () => { asks++; return bundle; } }, { app });
  await h.page.load();
  assert.equal(asks, 0, "the launch already asked; asking again would double the first paint");
  assert.equal(app.dashboardBootstrap, null, "a taken bundle must not be taken twice");
  assert.equal(h.page.data.profile.id, "owner");

  const stranger = dashboard({ bootstrapDashboard: async () => { asks++; return { ...bundle, userId: "someone-else" }; } }, {
    app: { globalData: { locale: "zh", profile: null }, dashboardBootstrap: Promise.resolve({ ...bundle, userId: "someone-else" }) },
  });
  await stranger.page.load();
  assert.equal(asks, 1, "another account's bundle must never be replayed into this one");
});

// app.js, with its own modules supplied so the launch path can be inspected alone.
function launch(session, bundle) {
  let asking = 0, app;
  vm.runInNewContext(read("app.js"), {
    App: d => { app = d; },
    console,
    require: path => path.endsWith("supabase")
      ? { restoreSession: () => session, bootstrapDashboard: async () => { asking++; return bundle; } }
      : path.endsWith("data-freshness") ? freshness
        : { loadRuntimeConfig: async () => ({ supabaseUrl: "https://synthetic.invalid", publishableKey: "public" }) },
    wx: { getAppBaseInfo: () => ({ language: "zh_CN" }), getStorageSync: () => null, setStorageSync() {} },
  });
  app.onLaunch();
  return { app, asked: () => asking };
}

test("launch asks ahead of the tab switch, but never without a signed-in account", async () => {
  const { bundle } = section("done");
  const signed = launch({ user: { id: "owner", email: "owner@example.invalid" }, access_token: "synthetic" }, bundle);
  assert.equal(signed.asked(), 1);
  assert.deepEqual(await signed.app.dashboardBootstrap, bundle);

  const guest = launch(null, bundle);
  assert.equal(guest.asked(), 0);
  assert.equal(guest.app.dashboardBootstrap, undefined, "a visitor must not trigger a request for someone else's records");
});

test("a write before the first paint discards the answer it started from", async () => {
  const { bundle } = section("done");
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const before = freshness.state.revision;
  const instance = launch({ user: { id: "owner" }, access_token: "synthetic" }, null);
  // Swap in a slow answer so the write can be simulated while the request is still open.
  instance.app.dashboardBootstrap = pending.then(() => bundle).then(value => (freshness.state.revision === before ? value : null));
  freshness.state.revision += 1;
  release();
  assert.equal(await instance.app.dashboardBootstrap, null, "stale after a write, so the page reads again");
  freshness.state.revision = before;
});

// utils/supabase.js on its own: the request this whole release hinges on.
function apiHarness(session, handlers) {
  const mod = { exports: {} };
  const requests = [];
  vm.runInNewContext(read("utils/supabase.js"), {
    module: mod,
    console,
    getApp: () => ({ globalData: {} }),
    require: path => path.endsWith("runtime-config")
      ? { loadRuntimeConfig: async () => ({ supabaseUrl: "https://synthetic.supabase.co", publishableKey: "public" }) }
      : path.endsWith("media-policy") ? require("../miniprogram/utils/media-policy.js")
        : path.includes("config") ? require("../miniprogram/config.js")
          : {},
    wx: {
      getStorageSync: () => session,
      setStorageSync() {},
      removeStorageSync() {},
      request(o) { requests.push(o); handlers.shift()(o); },
    },
  });
  return { api: mod.exports, requests, session };
}

const answer = body => o => o.success({ statusCode: 200, data: body });
const fail = (statusCode, body = {}) => o => o.success({ statusCode, data: body });

test("the merged request carries the device's own token, not the public key", async () => {
  const session = { user: { id: "owner" }, access_token: "synthetic-token", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const { api, requests } = apiHarness(session, [answer({ profile: PROFILE, setupRequired: false, entries: [ENTRY], checkins: CHECKINS, checkinCount: 4 })]);
  const bundle = await api.bootstrapDashboard();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://app.lifescale.space/api/miniprogram/bootstrap");
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].header.Authorization, "Bearer synthetic-token");
  assert.equal(bundle.profile.id, "owner");
  assert.equal(bundle.setupRequired, false);
  assert.equal(bundle.entries.length, 1);
  assert.equal(bundle.checkinCount, 4);
  assert.equal(bundle.userId, "owner");
});

test("a rotated token costs one refresh and one retry, then gives up", async () => {
  const session = { user: { id: "owner" }, access_token: "stale", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const refreshed = { user: { id: "owner" }, access_token: "fresh", refresh_token: "synthetic-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const { api, requests } = apiHarness(session, [
    fail(401, { message: "jwt expired" }),
    o => o.success({ statusCode: 200, data: refreshed }),
    answer({ profile: PROFILE, entries: [], checkins: [], checkinCount: 0 }),
  ]);
  const bundle = await api.bootstrapDashboard();
  assert.equal(requests.length, 3, "one refused bootstrap, one token refresh, one retry");
  assert.match(requests[1].url, /auth\/v1\/token\?grant_type=refresh_token$/);
  assert.equal(requests[2].header.Authorization, "Bearer fresh");
  assert.equal(bundle.profile.id, "owner");
});

test("a failure that is not the token keeps its status so the page can decide", async () => {
  const session = { user: { id: "owner" }, access_token: "synthetic", expires_at: Math.floor(Date.now() / 1000) + 3600 };
  const { api, requests } = apiHarness(session, [fail(404)]);
  const error = await api.bootstrapDashboard().then(() => null, failure => failure);
  assert.equal(requests.length, 1);
  assert.equal(error.status, 404);
  assert.ok(api.bootstrapUnsupported(error), "a missing endpoint is what the fallback is for");
  const real = Object.assign(new Error("down"), { status: 500 });
  assert.equal(api.bootstrapUnsupported(real), false, "a broken server must not masquerade as an old one");
});
