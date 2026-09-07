import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const { planCard, drawCard, formatDate, MAX_HEIGHT } = require("../miniprogram/utils/share-card.js");
const { normalizeAge, journeyMessage, openShare } = require("../miniprogram/utils/preferences.js");
const t = require("../miniprogram/utils/locale-copy.js");
const ctx = { measureText: (value) => ({ width: Array.from(value).length * 34 }) };

test("long records retain every character, paragraph and emoji across safe image sizes", () => {
  for (const layout of ["separate", "overlay"]) {
    for (const content of ["今天你好。🌿\n\nTomorrow's memories.", "记录🌿 hello ".repeat(1200), "\n".repeat(500)]) {
      const plan = planCard(ctx, content, { width: 1000, height: 1500 }, layout);
      assert.equal(plan.pages.flatMap((page) => page.lines).join(""), content.replace(/\n/g, ""));
      assert.ok(plan.pages.every((page) => page.height <= MAX_HEIGHT));
      assert.ok(plan.pages.every((page) => page.top + page.lines.length * plan.lineHeight <= page.height - 190));
      assert.ok(plan.pages.every((page) => page.lines.every((line) => ctx.measureText(line).width <= 592)));
    }
  }
});

test("short and normal journal entries produce one complete long image", () => {
  for (const content of ["今天。", "记录下今天的小事。".repeat(80)]) {
    const plan = planCard(ctx, content, null, "separate");
    assert.equal(plan.pages.length, 1);
    assert.ok(plan.pages[0].height >= 900);
  }
});

test("overlay uses a fixed high-contrast panel and renders no private account fields", () => {
  const texts = [], panels = [];
  const context = { ...ctx, fillRect(...args) { panels.push([this.fillStyle, ...args]); }, drawImage() {}, fillText(value) { texts.push(value); } };
  const canvas = { getContext: () => context };
  const entry = { content: "public test", entry_date: "2026-09-07", moodLabel: "平静", email: "SECRET_EMAIL", birth_date: "SECRET_BIRTH", gender_identity: "SECRET_GENDER", target_age: "SECRET_AGE", imageUrl: "SECRET_URL" };
  const plan = planCard(context, entry.content, { width: 1, height: 1 }, "overlay");
  drawCard(canvas, { width: 1, height: 1 }, entry, plan, 0, "en");
  assert.ok(panels.some(([color]) => color === "rgba(6,30,22,.88)"));
  assert.ok(texts.includes("public test"));
  assert.ok(texts.includes("07/09/2026"));
  assert.doesNotMatch(texts.join(" "), /SECRET/);
});

test("share navigation passes a copy in memory and never a private URL", () => {
  let options, emitted;
  global.wx = { navigateTo(value) { options = value; } };
  const entry = { content: "private until confirmed", imageUrl: "signed-url" };
  openShare(entry, "zh-TW");
  assert.equal(options.url, "/pages/share/share");
  options.success({ eventChannel: { emit(name, value) { emitted = { name, value }; } } });
  assert.equal(emitted.name, "entry");
  assert.equal(emitted.value.entry, entry);
  delete global.wx;
});

test("image share entrance stays generic and no entry is published on opening share", async () => {
  const source = await readFile(new URL("../miniprogram/pages/share/share.js", import.meta.url), "utf8");
  assert.match(source, /showShareImageMenu/);
  assert.match(source, /entrancePath: "pages\/index\/index"/);
  assert.doesNotMatch(source, /wx\.request|supabase|visibility:\s*["']public/);
  assert.match(source, /saveImageToPhotosAlbum/);
});

test("blank ages, leading zeros, dates and selected locales remain usable", () => {
  assert.equal(normalizeAge(""), "");
  assert.equal(normalizeAge("070"), "70");
  assert.equal(normalizeAge("0"), "");
  assert.equal(formatDate("2026-09-07T15:00:00Z", "en"), "07/09/2026");
  assert.equal(formatDate("2026-09-07", "zh-TW"), "2026年9月7日");
  assert.equal(formatDate(undefined), "");
  assert.match(journeyMessage(1), /第一天/);
  assert.match(journeyMessage(100), /不要让别人定义你/);
  assert.equal(t("图文分开", "en"), "Photo + text");
  assert.equal(t("图文分开", "zh-TW"), "圖文分開");
});
