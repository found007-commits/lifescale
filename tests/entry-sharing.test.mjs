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
  assert.match(dialog, /MicroMessenger/);
  assert.match(dialog, /微信内直接操作/);
  assert.match(dialog, /if \(inWeChat\)/);
  assert.match(dialog, /entry\.entry_date\.slice\(0, 10\)/);
  assert.doesNotMatch(dialog, /updateProfile|insertEntry|visibility:\s*["']public/);
});
