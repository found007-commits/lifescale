"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { EntryMedia } from "../../lib/types";
import { signMedia } from "../../lib/lifescale-data";

export function MediaViewer({ media, en }: { media: EntryMedia[]; en: boolean }) {
  const [selected, setSelected] = useState<EntryMedia | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);
  function close() { generation.current++; setSelected(null); setUrl(""); setError(""); }
  async function open(item: EntryMedia) {
    const request = ++generation.current;
    setSelected(item); setUrl(""); setError("");
    try { const value = await signMedia(item); if (request === generation.current) setUrl(value); }
    catch { if (request === generation.current) setError(en ? "Could not load this file. Retry." : "媒体加载失败，请重试。"); }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { generation.current++; setSelected(null); setUrl(""); } };
    window.addEventListener("keydown", key);
    // This ref is a request generation counter, not a DOM node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; window.removeEventListener("keydown", key); };
  }, []);
  return <>
    <div className={"entry-photo-grid" + (media.length === 1 ? " single" : "")}>
      {media.map((item, i) => <button type="button" key={item.id} onClick={() => void open(item)} aria-label={(en ? "Open media " : "打开媒体 ") + (i + 1)}>
        {item.media_type.startsWith("video/") ? <span className="media-placeholder video-preview"><span className="video-play-icon" aria-hidden="true">▶</span><strong>{en ? "Video record" : "视频记录"}</strong><span>{en ? "Open player" : "点击打开播放器"}</span><small>{en ? "Loads only when opened" : "点开后加载，不自动播放"}</small></span> : item.media_type === "image/gif" ? <span className="media-placeholder">GIF · {en ? "Tap to play" : "点开播放"}</span> : item.signed_url ? <Image src={item.signed_url} width={720} height={480} loading="lazy" unoptimized alt={(en ? "Journal photo " : "记录照片 ") + (i + 1)} /> : <span>{en ? "Open image" : "查看图片"}</span>}
      </button>)}
    </div>
    {selected ? <div className="modal-backdrop gallery-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="gallery-dialog media-viewer-dialog" role="dialog" aria-modal="true" aria-label={en ? "Media" : "影像"}>
      <header className="media-viewer-toolbar">
        <button type="button" className="media-viewer-close" onClick={close} aria-label={en ? "Close media" : "关闭影像"}><span aria-hidden="true">×</span>{en ? "Close" : "关闭"}</button>
        <span className="media-viewer-title">{selected.media_type.startsWith("video/") ? (en ? "Video" : "视频") : (en ? "Image" : "图片")}</span>
      </header>
      {/* User-owned originals have no supplied caption track; do not fabricate subtitles. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {error ? <p role="alert">{error}<button onClick={() => void open(selected)}>{en ? "Retry" : "重试"}</button></p> : !url ? <p>{en ? "Loading…" : "正在加载…"}</p> : selected.media_type.startsWith("video/") ? <video key={url} src={url} controls playsInline preload="metadata" onError={() => setError(en ? "This device cannot play the video. Try the original file." : "当前设备无法播放，请打开原视频后重试。")} /> : <Image src={url} width={1600} height={1600} unoptimized alt={en ? "Journal image" : "记录图片"} onError={() => setError(en ? "Could not load image." : "图片加载失败。")} />}
      {url ? <a href={url} target="_blank" rel="noreferrer">{en ? "Open original file" : "打开原文件"}</a> : null}
      <div>{media.map((item, i) => <button key={item.id} disabled={selected.id === item.id} onClick={() => void open(item)}>{i + 1}</button>)}</div>
    </section></div> : null}
  </>;
}
