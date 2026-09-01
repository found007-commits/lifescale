"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { LifeEntry, Locale } from "../../lib/types";

type ShareTarget = "wechat" | "moments" | "facebook" | "instagram" | "more";

const moodLabels: Record<string, { zh: string; en: string }> = {
  calm: { zh: "平静", en: "Calm" }, happy: { zh: "开心", en: "Happy" }, grateful: { zh: "感恩", en: "Grateful" },
  tired: { zh: "疲惫", en: "Tired" }, sad: { zh: "难过", en: "Sad" }, anxious: { zh: "焦虑", en: "Anxious" }, hopeful: { zh: "充满希望", en: "Hopeful" },
};
const categoryLabels: Record<string, { zh: string; en: string }> = {
  daily: { zh: "日常", en: "Daily life" }, family: { zh: "家人", en: "Family" }, work: { zh: "工作", en: "Work" },
  growth: { zh: "成长", en: "Growth" }, health: { zh: "健康", en: "Health" }, travel: { zh: "旅行", en: "Travel" },
  reflection: { zh: "感悟", en: "Reflection" }, other: { zh: "其他", en: "Other" },
};

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  const paragraphs = text.trim().split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let current = "";
    for (const character of Array.from(paragraph)) {
      const next = current + character;
      if (context.measureText(next).width > maxWidth && current) {
        lines.push(current.trimEnd());
        current = character;
      } else current = next;
    }
    if (current) lines.push(current.trimEnd());
  }
  return lines.length ? lines : [""];
}

function createShareCard(entry: LifeEntry, locale: Locale): Promise<{ blob: Blob | null; dataUrl: string; height: number }> {
  const en = locale === "en";
  const content = entry.content.trim() || (en ? "Today was worth remembering." : "今天，也值得被记住。");
  const fontSize = content.length > 5000 ? 30 : content.length > 2500 ? 36 : content.length > 1200 ? 44 : content.length > 600 ? 50 : en ? 55 : 58;
  const lineHeight = Math.ceil(fontSize * 1.42);
  const contentFont = en ? `500 ${fontSize}px Georgia, serif` : `500 ${fontSize}px 'Songti SC', 'Noto Serif CJK SC', serif`;
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = 1080;
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) return Promise.resolve({ blob: null, dataUrl: "", height: 1350 });
  measureContext.font = contentFont;
  const lines = wrapText(measureContext, content, 920);
  const contentTop = 420;
  const contentBottom = contentTop + Math.max(0, lines.length - 1) * lineHeight + fontSize;
  const tagTop = Math.max(1085, contentBottom + 64);
  const cardHeight = Math.ceil(tagTop + 265);

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = cardHeight;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve({ blob: null, dataUrl: "", height: cardHeight });

  context.fillStyle = "#f4f0e6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#143d2f";
  context.fillRect(0, 0, canvas.width, 218);
  context.fillStyle = "#d79b2f";
  context.fillRect(76, 170, 82, 5);

  context.fillStyle = "#ffffff";
  context.font = "600 48px Georgia, serif";
  context.fillText(en ? "A day I chose to keep" : "我选择留下的这一天", 76, 105);
  context.fillStyle = "#d8e1dc";
  context.font = "600 20px system-ui, sans-serif";
  context.fillText("余生有刻 · LIFESCALE", 76, 151);

  const entryDate = entry.entry_date.slice(0, 10);
  const date = new Date(`${entryDate}T12:00:00`).toLocaleDateString(en ? "en-GB" : locale === "zh-TW" ? "zh-TW" : "zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  context.fillStyle = "#8a6414";
  context.font = "700 25px system-ui, sans-serif";
  context.fillText(date, 76, 315);

  context.fillStyle = "#143d2f";
  context.font = contentFont;
  lines.forEach((line, index) => context.fillText(line, 76, contentTop + index * lineHeight));

  const mood = moodLabels[entry.mood]?.[en ? "en" : "zh"] || entry.mood;
  const category = categoryLabels[entry.category]?.[en ? "en" : "zh"] || entry.category;
  context.fillStyle = "rgba(20,61,47,.09)";
  context.beginPath(); context.roundRect(76, tagTop, 928, 100, 26); context.fill();
  context.fillStyle = "#143d2f";
  context.font = "600 25px system-ui, sans-serif";
  context.fillText(`${mood}  ·  ${category}`, 112, tagTop + 63);

  context.fillStyle = "#64766e";
  context.font = "500 21px system-ui, sans-serif";
  context.fillText(en ? "See the life ahead. Make today count." : "看见余生，认真今天。", 76, tagTop + 178);
  context.textAlign = "right";
  context.fillStyle = "#8a6414";
  context.fillText("app.lifescale.space", 1004, tagTop + 178);

  const dataUrl = canvas.toDataURL("image/png", 0.94);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve({ blob, dataUrl, height: cardHeight }), "image/png", 0.94));
}

function downloadBlob(blob: Blob, entryDate: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifescale-${entryDate}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EntryShareDialog({ entry, locale, onClose }: { entry: LifeEntry; locale: Locale; onClose: () => void }) {
  const en = locale === "en";
  const [card, setCard] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [status, setStatus] = useState("");
  const [cardUrl, setCardUrl] = useState("");
  const [cardHeight, setCardHeight] = useState(1350);
  const inWeChat = useMemo(() => typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent), []);
  const copy = useMemo(() => ({
    wechat: en ? "WeChat" : "微信好友", moments: en ? "WeChat Moments" : "朋友圈", facebook: "Facebook", instagram: "Instagram", more: en ? "More" : "更多",
  }), [en]);

  useEffect(() => {
    let active = true;
    void createShareCard(entry, locale).then(({ blob, dataUrl, height }) => {
      if (!active) return;
      setCardUrl(dataUrl);
      setCardHeight(height);
      setCard(blob);
      setPreparing(false);
    });
    return () => { active = false; };
  }, [entry, locale]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function share(target: ShareTarget) {
    if (!card) return;
    if (inWeChat) {
      if (target === "wechat") setStatus(en ? "Press and hold the card above, then choose Send to Chat." : "请长按上方分享卡，选择“发送给朋友”。无需离开微信。");
      else if (target === "moments") setStatus(en ? "Press and hold the card above to save it, then post it to Moments." : "请长按上方分享卡保存图片，再直接发布到朋友圈。无需打开外部浏览器。");
      else setStatus(en ? `Press and hold the card above to save it, then post it to ${copy[target]}.` : `请长按上方分享卡保存图片，再发布到${copy[target]}。`);
      return;
    }
    const entryDate = entry.entry_date.slice(0, 10);
    const file = new File([card], `lifescale-${entryDate}.png`, { type: "image/png" });
    const data: ShareData = { files: [file], title: en ? "A day I chose to keep · LifeScale" : "我选择留下的这一天 · 余生有刻", text: entry.content.slice(0, 180) };
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share(data);
        setStatus(en ? "Shared. Your original entry remains private." : "已交给系统分享，原记录仍仅你可见。");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    downloadBlob(card, entryDate);
    const targetName = copy[target];
    setStatus(en ? `The card was saved. Open ${targetName} and choose it to post.` : `分享卡已保存，请打开${targetName}并选择这张图片发布。`);
  }

  function saveCard() {
    if (!card) return;
    if (inWeChat) {
      setStatus(en ? "Press and hold the card above, then choose Save Image." : "请长按上方分享卡，选择“保存图片”。无需转到外部浏览器。");
      return;
    }
    downloadBlob(card, entry.entry_date.slice(0, 10));
    setStatus(en ? "Share card saved." : "分享卡已保存到设备。");
  }

  return <div className="modal-backdrop share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label={en ? "Close" : "关闭"}>×</button>
      <p className="kicker">SHARE A DAY</p>
      <h2 id="share-dialog-title">{en ? "Share this day" : "分享这一天"}</h2>
      <p className="share-privacy">{en ? "Only the copy you confirm is shared. Your original entry stays private. The card contains no email, birth date or life target." : "只分享你确认的副本。原记录继续保持私密，分享卡不含邮箱、出生日期或人生目标。"}</p>
      {inWeChat ? <p className="wechat-direct-hint">{en ? "In WeChat: press and hold the card to send or save it. You do not need another browser." : "微信内直接操作：长按分享卡即可发送给朋友或保存图片，不需要转到浏览器。"}</p> : null}
      <div className="share-card-preview-image">{cardUrl ? <Image src={cardUrl} alt={en ? "Preview of the complete share card" : "完整分享卡预览"} width={1080} height={cardHeight} unoptimized /> : <span>{en ? "Preparing your share card…" : "正在生成分享卡…"}</span>}</div>
      <div className="share-platform-grid" aria-label={en ? "Share choices" : "分享方式"}>
        {(["wechat", "moments", "facebook", "instagram", "more"] as ShareTarget[]).map((target) => <button type="button" key={target} disabled={preparing} onClick={() => void share(target)}><b>{target === "wechat" ? "微" : target === "moments" ? "圈" : target === "facebook" ? "f" : target === "instagram" ? "◎" : "···"}</b><span>{copy[target]}</span></button>)}
      </div>
      <button className="outline-button share-save-button" type="button" disabled={preparing} onClick={saveCard}>{preparing ? (en ? "Preparing card…" : "正在生成分享卡…") : inWeChat ? (en ? "Press and hold the card to save" : "长按上方分享卡保存") : (en ? "Save share card" : "保存分享卡")}</button>
      {status ? <p className="share-status" role="status">{status}</p> : null}
      <p className="share-platform-note">{inWeChat ? (en ? "WeChat does not allow a web page to publish a Moments post for you. You always make the final choice." : "微信不允许网页替你发布朋友圈，最终发送或发布始终由你确认。") : (en ? "Available apps depend on your device. If a platform cannot be opened directly, LifeScale saves the card for you to post manually." : "可直接调用的平台由设备决定；无法直接打开指定平台时，会保存图片供你手动发布。")}</p>
    </section>
  </div>;
}
