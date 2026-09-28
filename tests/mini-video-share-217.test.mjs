import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const readRoot = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const entryJs = readRoot("miniprogram/pages/entry/entry.js");
const release = JSON.parse(readRoot("miniprogram/package.json")).version === "2.0.17";

// 2.0.17: WeChat's two native share APIs sit behind one branch in shareMedia. Their
// parameter names are not interchangeable: showShareImageMenu takes { filePath, path },
// shareVideoMessage takes { videoPath, thumbPath? }. The old code forwarded filePath to
// both, so on iPhone 17 Pro the video card never reached the share sheet — the API
// silently rejected the call because videoPath is required and we never entered it.
// The tests pin the parameter names from the source so the bug cannot regress without a
// deliberate edit.

// Pull just the body of shareMedia so the assertion doesn't accidentally match comments
// or strings elsewhere in the file.
const shareMediaMatch = entryJs.match(/async shareMedia\(event\)\s*\{[\s\S]*?^\s*\},/m);
assert.ok(shareMediaMatch, "shareMedia must exist on the entry page");
const shareMedia = shareMediaMatch[0];

test("shareMedia hands videoPath to the video branch and filePath to the image branch", () => {
  // The video branch must build { videoPath: result.tempFilePath } — passing filePath
  // to shareVideoMessage silently fails because videoPath is required and we never enter it.
  assert.match(shareMedia, /item\.kind\s*===\s*["']video["']\s*\?\s*\{\s*videoPath:\s*result\.tempFilePath\s*\}\s*:\s*\{\s*filePath:\s*result\.tempFilePath/);
});

test("shareMedia calls shareVideoMessage for video, showShareImageMenu for image", () => {
  assert.match(entryJs, /shareVideoMessage/);
  assert.match(entryJs, /showShareImageMenu/);
  assert.match(entryJs, /item\.kind\s*===\s*["']video["']\s*\?\s*["']shareVideoMessage["']\s*:\s*["']showShareImageMenu["']/);
});

test("shareMedia no longer hands filePath to shareVideoMessage directly", () => {
  // Belt and braces: the literal `wx[method]({ filePath, path })` shape from the old bug
  // must not come back, even wrapped — the parameter names must branch on kind first.
  assert.doesNotMatch(shareMedia, /wx\[method\]\(\{\s*filePath:\s*result\.tempFilePath,\s*path:\s*result\.tempFilePath/);
});

test("shareMedia still sends the filePath/path pair to the image branch", () => {
  // The image branch is unchanged: showShareImageMenu wants { filePath, path } and a
  // failure here would surface to readers as "分享失败，请重试" on every image.
  assert.match(shareMedia, /\{\s*filePath:\s*result\.tempFilePath,\s*path:\s*result\.tempFilePath\s*\}/);
});

test("2.0.17 moves the mini program version to 2.0.17", { skip: !release }, () => {
  assert.equal(JSON.parse(readRoot("miniprogram/package.json")).version, "2.0.17");
});