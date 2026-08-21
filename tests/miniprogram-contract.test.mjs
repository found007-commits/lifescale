import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const require = createRequire(import.meta.url);
const life = require("../miniprogram/utils/life.js");

test("mini program uses calendar years and never returns a negative countdown", () => {
  assert.equal(life.targetDateFromAge("2000-02-29", 30), "2030-02-28");
  const metrics = life.calculateLifeMetrics({ birthDate: "1990-01-01", targetDate: "2025-01-01" });
  assert.ok(metrics.remainingDays >= 0);
});

test("every declared mini program page has complete native files", async () => {
  const app = JSON.parse(await source("miniprogram/app.json"));
  for (const page of app.pages) {
    for (const extension of ["js", "json", "wxml", "wxss"]) await access(new URL(`miniprogram/${page}.${extension}`, root));
  }
});

test("mini program keeps email OTP as its only login method", async () => {
  const auth = await source("miniprogram/pages/auth/auth.js");
  const api = await source("miniprogram/utils/supabase.js");
  assert.match(auth, /sendOtp/);
  assert.match(auth, /verifyOtp/);
  assert.doesNotMatch(`${auth}\n${api}`, /google|facebook|apple|wechat.*login/i);
});

test("the Chinese manifesto headline has intentional two-line copy", async () => {
  const [website, miniProgram] = await Promise.all([source("app/components/Experience.tsx"), source("miniprogram/pages/index/index.wxml")]);
  assert.match(website, /pillarsTitle: \["不是倒数生命，", "而是把今天留下。"\]/);
  assert.match(miniProgram, /<text>不是倒数生命，<\/text><text>而是把今天留下。<\/text>/);
});

test("the mini program presents the Yusheng Youke product brand", async () => {
  const [app, landing, auth] = await Promise.all([
    source("miniprogram/app.json"),
    source("miniprogram/pages/index/index.wxml"),
    source("miniprogram/pages/auth/auth.wxml"),
  ]);
  assert.match(app, /余生有刻/);
  assert.match(landing, /余生有刻/);
  assert.match(auth, /余生有刻/);
});
