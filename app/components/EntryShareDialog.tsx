"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { planCard, drawCard } from "../../miniprogram/utils/share-card";
import type { LifeEntry, Locale } from "../../lib/types";

type ShareTarget = "wechat" | "moments" | "facebook" | "instagram" | "more";
type ShareLayout = "separate" | "overlay";
type ShareCard = { blob: Blob; dataUrl: string; height: number };
const moodLabels: Record<string, string> = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels: Record<string, string> = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

async function loadSharePhoto(url: string) {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Photo unavailable / 照片暂不可用，请刷新记录重试。");
  const objectUrl = URL.createObjectURL(await response.blob());
  const image = new window.Image(), canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error("Unable to decode photo / 无法读取照片。"));
      image.src = objectUrl;
    });
    // Retain smaller decoded copies for albums instead of many full-resolution bitmaps.
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const reduced = new window.Image(), dataUrl = canvas.toDataURL("image/jpeg", .92);
    await new Promise<void>((resolve, reject) => {
      reduced.onload = () => resolve(); reduced.onerror = () => reject(new Error("Image preparation failed"));
      reduced.src = dataUrl;
    });
    return reduced;
  } finally { URL.revokeObjectURL(objectUrl); image.src = ""; canvas.width = canvas.height = 1; }
}

async function createShareCards(entry: LifeEntry, locale: Locale, layout: ShareLayout, backgroundIndex: number, cancelled: () => boolean): Promise<ShareCard[]> {
  const en = locale === "en", photos: HTMLImageElement[] = [], canvas = document.createElement("canvas");
  try {
    for (const media of entry.entry_media || []) {
      if (cancelled()) return [];
      if (!media.signed_url) throw new Error(en ? "A photo is unavailable. Refresh your journal and retry; no photo will be silently omitted." : "有照片暂时无法读取，请刷新记录重试；不会省略照片生成分享卡。");
      photos.push(await loadSharePhoto(media.signed_url));
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(en ? "Image generation is unavailable." : "当前设备无法生成图片。");
    const plan = planCard(ctx, entry.content.trim() || (en ? "Today was worth remembering." : "今天，也值得被记住。"), photos, layout, { width: 1080, backgroundIndex });
    const copy = { entry_date: entry.entry_date, moodLabel: moodLabels[entry.mood], categoryLabel: categoryLabels[entry.category] };
    const cards: ShareCard[] = [];
    for (let index = 0; index < plan.pages.length; index++) {
      if (cancelled()) return [];
      drawCard(canvas, photos, copy, plan, index, locale);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob?.size) throw new Error(en ? "Image export failed. Retry." : "图片导出失败，请重试。");
      cards.push({ blob, dataUrl: canvas.toDataURL("image/png"), height: canvas.height });
    }
    return cards;
  } finally { canvas.width = canvas.height = 1; photos.forEach((photo) => { photo.src = ""; }); }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EntryShareDialog({ entry, locale, onClose }: { entry: LifeEntry; locale: Locale; onClose: () => void }) {
  const en = locale === "en";
  const [cards, setCards] = useState<ShareCard[]>([]);
  const [selected, setSelected] = useState(0);
  const [layout, setLayout] = useState<ShareLayout>("separate");
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [generatedKey, setGeneratedKey] = useState("");
  const hasPhoto = Boolean(entry.entry_media?.length);
  const key = [entry.id, entry.updated_at, locale, layout, backgroundIndex, retry].join(":");
  const preparing = key !== generatedKey;
  const card = !preparing ? cards[selected] : undefined;
  const inWeChat = useMemo(() => typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent), []);
  const copy = { wechat: en ? "WeChat" : "微信好友", moments: en ? "WeChat Moments" : "朋友圈", facebook: "Facebook", instagram: "Instagram", more: en ? "More" : "更多" };
  const fileName = "lifescale-" + entry.entry_date.slice(0, 10) + "-" + (selected + 1) + ".png";

  useEffect(() => {
    let active = true;
    void createShareCards(entry, locale, layout, backgroundIndex, () => !active).then((result) => {
      if (!active) return;
      setCards(result); setSelected(0); setError(""); setGeneratedKey(key);
    }).catch((caught) => {
      if (!active) return;
      setCards([]); setError(caught instanceof Error ? caught.message : "图片生成失败"); setGeneratedKey(key);
    });
    return () => { active = false; };
  }, [entry, locale, layout, backgroundIndex, key]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  async function share(target: ShareTarget) {
    if (!card) return;
    if (inWeChat) {
      setStatus(target === "wechat" ? (en ? "Press and hold the card to send it to a friend." : "请长按分享卡，选择“发送给朋友”，无需离开微信。") : (en ? "Press and hold the card to save it, then post it to " + copy[target] + "." : "请长按分享卡保存图片，再发布到" + copy[target] + "，无需打开外部浏览器。"));
      return;
    }
    const file = new File([card.blob], fileName, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: en ? "A day I chose to keep · LifeScale" : "我选择留下的这一天 · 余生有刻" });
        setStatus(en ? "Shared. Your original stays private." : "已交给系统分享，原记录仍保持私密。");
        return;
      } catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; }
    }
    downloadBlob(card.blob, fileName);
    setStatus(en ? "Image saved. Choose it in " + copy[target] + " to post." : "图片已保存，请在" + copy[target] + "中选择发布。");
  }
  function saveCard() {
    if (!card) return;
    if (inWeChat) { setStatus(en ? "Press and hold the image, then choose Save Image." : "请长按上方分享卡，选择“保存图片”，无需转到外部浏览器。"); return; }
    downloadBlob(card.blob, fileName);
    setStatus(en ? "Share card saved." : "分享卡已保存。");
  }

  return <div className="modal-backdrop share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <button className="modal-close" onClick={onClose} aria-label={en ? "Close" : "关闭"}>×</button>
      <p className="kicker">SHARE A DAY</p><h2 id="share-dialog-title">{en ? "Share this day" : "分享这一天"}</h2>
      <p className="share-privacy">{en ? "Only the copy you confirm is shared. Your original stays private. Account details are not added to the card." : "只分享你确认的副本。原记录继续保持私密，分享卡不添加邮箱、出生日期或人生目标。"}</p>
      {inWeChat ? <p className="wechat-direct-hint">{en ? "In WeChat: press and hold the card to send or save it. No external browser needed." : "微信内直接操作：长按分享卡即可发送或保存，不需要转到浏览器。"}</p> : null}
      <div className="share-layout-control"><span>{en ? "Card layout" : "分享卡排版"}</span>
        <div role="group" aria-label={en ? "Card layout" : "分享卡排版"}>
          <button type="button" className={layout === "separate" ? "active" : ""} aria-pressed={layout === "separate"} onClick={() => setLayout("separate")}>{en ? "Photo + text" : "图文分开"}</button>
          <button type="button" className={layout === "overlay" ? "active" : ""} aria-pressed={layout === "overlay"} disabled={!hasPhoto} onClick={() => setLayout("overlay")}>{en ? "Text on photo" : "文字镶嵌"}</button>
        </div>
        <small>{layout === "overlay" ? (en ? "A high-contrast text panel. The full photo album follows the text." : "加深文字底板，保证清楚易读；整组照片保留在文字后方。") : (en ? "All photos stay in order, followed by the complete entry." : "所有照片按顺序完整排列，全部记录文字一并保留。")}</small>
      </div>
      {layout === "overlay" && (entry.entry_media?.length || 0) > 1 ? <div className="share-backgrounds" role="group" aria-label={en ? "Choose background photo" : "选择背景照片"}>
        <span>{en ? "Choose background · all photos stay in the album" : "选择背景图 · 整组照片都会保留"}</span>
        {entry.entry_media?.map((media, index) => <button type="button" key={media.id} aria-pressed={backgroundIndex === index} onClick={() => setBackgroundIndex(index)}>{media.signed_url ? <Image src={media.signed_url} width={72} height={60} unoptimized alt={(en ? "Photo " : "照片 ") + (index + 1)} /> : index + 1}</button>)}
      </div> : null}
      {error && !preparing ? <p className="form-status" role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>{en ? "Retry" : "重试"}</button></p> : null}
      {cards.length > 1 && !preparing ? <div className="share-pages"><p>{en ? "The complete album spans multiple images. Choose a page to save or share; nothing is omitted." : "内容较长，已完整分为多张，未省略文字或照片。选择一张保存或分享，可逐张保存全部内容。"}</p>{cards.map((_, index) => <button type="button" key={index} aria-pressed={selected === index} onClick={() => setSelected(index)}>{index + 1} / {cards.length}</button>)}</div> : null}
      <div className="share-card-preview-image">{card ? <Image src={card.dataUrl} alt={en ? "Complete share card preview" : "完整分享卡预览"} width={1080} height={card.height} unoptimized /> : <span>{preparing ? (en ? "Preparing your complete album…" : "正在生成完整相册…") : (en ? "Retry to create the card." : "请重试生成图片。")}</span>}</div>
      <div className="share-platform-grid" aria-label={en ? "Share choices" : "分享方式"}>
        {(["wechat", "moments", "facebook", "instagram", "more"] as ShareTarget[]).map((target) => <button type="button" key={target} disabled={!card} onClick={() => void share(target)}><b>{target === "wechat" ? "微" : target === "moments" ? "圈" : target === "facebook" ? "f" : target === "instagram" ? "◎" : "···"}</b><span>{copy[target]}</span></button>)}
      </div>
      <button className="outline-button share-save-button" type="button" disabled={!card} onClick={saveCard}>{inWeChat ? (en ? "Press and hold the card to save" : "长按上方分享卡保存") : (en ? "Save this share card" : "保存这张分享卡")}</button>
      {status ? <p className="share-status" role="status">{status}</p> : null}
      <p className="share-platform-note">{en ? "Your device determines which apps are available. You always confirm the recipient and publication." : "可直接调用的平台由设备决定。最终发送对象和发布始终由你确认。"}</p>
    </section>
  </div>;
}
