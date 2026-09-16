import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MediaViewer } from "../app/components/MediaViewer";
import type { EntryMedia } from "../lib/types";
import { readFileSync } from "node:fs";
test("a video renders as a playable card, never a broken image or eager video download", () => {
  const media = [{id:"synthetic",media_type:"video/mp4",storage_path:"private/clip.mp4",signed_url:"https://synthetic.invalid/clip.mp4"}] as EntryMedia[];
  const html = renderToStaticMarkup(createElement(MediaViewer,{media,en:false}));
  assert.match(html,/视频记录/);assert.match(html,/点击打开播放器/);
  assert.doesNotMatch(html,/<img|<video|https:\/\/synthetic/);
});
test("media close control has its own toolbar, visible text and a large focusable target", () => {
  const source = readFileSync(new URL("../app/components/MediaViewer.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /<header className="media-viewer-toolbar">/);
  assert.match(source, /type="button" className="media-viewer-close" onClick=\{close\}/);
  assert.match(source, /"Close" : "关闭"/);
  assert.doesNotMatch(source, /className="modal-close"/);
  assert.match(css, /\.media-viewer-dialog \.media-viewer-close \{[^}]*min-height: 44px;[^}]*background: #b42318;[^}]*color: #fff;/);
  assert.match(css, /\.media-viewer-dialog \.media-viewer-close:focus-visible/);
  assert.match(source, /event.key === "Escape"/);
});
