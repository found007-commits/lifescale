import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("each daily entry offers an explicit private-safe share action", async () => {
  const [dashboard, dialog] = await Promise.all([
    source("app/components/Dashboard.tsx"),
    source("app/components/EntryShareDialog.tsx"),
  ]);
  assert.match(dashboard, /entry-share-button/);
  assert.match(dashboard, /<EntryShareDialog/);
  assert.match(dialog, /navigator\.share/);
  assert.match(dialog, /navigator\.canShare/);
  assert.match(dialog, /微信好友/);
  assert.match(dialog, /朋友圈/);
  assert.match(dialog, /Facebook/);
  assert.match(dialog, /Instagram/);
  assert.match(dialog, /原记录继续保持私密/);
  assert.match(dialog, /canvas\.toBlob/);
  assert.match(dialog, /planCard\(ctx, entry\.content/);
  assert.match(dialog, /for \(const media of entry.entry_media/);
  assert.match(dialog, /for \(let index = 0; index < plan.pages.length/);
  assert.doesNotMatch(dialog, /wrapText\([^)]*,\s*9\)/);
  assert.doesNotMatch(dialog, /lines\[lines\.length - 1\].*…/);
  assert.match(dialog, /MicroMessenger/);
  assert.match(dialog, /微信内直接操作/);
  assert.match(dialog, /if \(inWeChat\)/);
  assert.match(dialog, /entry\.entry_date\.slice\(0, 10\)/);
  assert.match(dialog, /type ShareLayout = "separate" \| "overlay"/);
  assert.match(dialog, /图文分开/);
  assert.match(dialog, /文字镶嵌/);
  assert.match(dialog, /drawCard\(canvas, photos/);
  assert.match(dialog, /setBackgroundIndex/);
  assert.match(dialog, /加深文字底板/);
  assert.match(dialog, /disabled=!\{hasPhoto\}|disabled=\{!hasPhoto\}/);
  assert.doesNotMatch(dialog, /updateProfile|insertEntry|visibility:\s*["']public/);
});
