"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { EntryMedia } from "../../lib/types";

export function EntryGallery({ media, en }: { media: EntryMedia[]; en: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const photos = media.filter((photo) => photo.signed_url);
  useEffect(() => {
    if (index === null) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setIndex(null); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [index]);
  return <>
    <div className={"entry-photo-grid" + (photos.length === 1 ? " single" : "")}>
      {photos.map((photo, i) => <button type="button" key={photo.id} onClick={() => setIndex(i)} aria-label={(en ? "View photo " : "查看照片 ") + (i + 1)}><Image src={photo.signed_url!} width={720} height={480} unoptimized alt={(en ? "Journal photo " : "记录照片 ") + (i + 1)} /></button>)}
    </div>
    {index !== null && photos[index] ? <div className="modal-backdrop gallery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIndex(null); }}><section className="gallery-dialog" role="dialog" aria-modal="true" aria-label={en ? "Photo album" : "照片相册"}>
      <button className="modal-close" onClick={() => setIndex(null)} aria-label={en ? "Close" : "关闭"}>×</button>
      <Image src={photos[index].signed_url!} width={1600} height={1600} unoptimized alt={(en ? "Photo " : "照片 ") + (index + 1)} />
      <div><button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>{en ? "Previous" : "上一张"}</button><span>{index + 1} / {photos.length}</span><button type="button" disabled={index + 1 >= photos.length} onClick={() => setIndex(index + 1)}>{en ? "Next" : "下一张"}</button></div>
    </section></div> : null}
  </>;
}
