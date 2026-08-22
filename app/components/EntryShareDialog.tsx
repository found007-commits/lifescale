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

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const characters = Array.from(text.trim());
  const lines: string[] = [];
  let current = "";
  for (const character of characters) {
    const next = current + character;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current.trim());
      current = character;
      if (lines.length === maxLines) break;
    } else current = next;
  }
  if (lines.length < maxLines && current.trim()) lines.push(current.trim());
  const usedLength = lines.join("").length;
  if (usedLength < characters.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。,.!?！？\s]+$/, "")}…`;
  return lines;
}

function createShareCard(entry: LifeEntry, locale: Locale): Promise<Blob | null> {
  const en = locale === "en";
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);

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

  const date = new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString(en ? "en-GB" : locale === "zh-TW" ? "zh-TW" : "zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  context.fillStyle = "#8a6414";
  context.font = "700 25px system-ui, sans-serif";
  context.fillText(date, 76, 315);

  const content = entry.content.trim() || (en ? "Today was worth remembering." : "今天，也值得被记住。");
  context.fillStyle = "#143d2f";
  context.font = en ? "500 55px Georgia, serif" : "500 58px 'Songti SC', 'Noto Serif CJK SC', serif";
  const lines = wrapText(context, content, 920, 9);
  lines.forEach((line, index) => context.fillText(line, 76, 420 + index * 82));

  const mood = moodLabels[entry.mood]?.[en ? "en" : "zh"] || entry.mood;
  const category = categoryLabels[entry.category]?.[en ? "en" : "zh"] || entry.category;
  context.fillStyle = "rgba(20,61,47,.09)";
  context.beginPath(); context.roundRect(76, 1085, 928, 100, 26); context.fill();
  context.fillStyle = "#143d2f";
  context.font = "600 25px system-ui, sans-serif";
  context.fillText(`${mood}  ·  ${category}`, 112, 1148);

  context.fillStyle = "#64766e";
  context.font = "500 21px system-ui, sans-serif";
  context.fillText(en ? "See the life ahead. Make today count." : "看见余生，认真今天。", 76, 1263);
  context.textAlign = "right";
  context.fillStyle = "#8a6414";
  context.fillText("app.lifescale.space", 1004, 1263);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.94));
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
  const copy = useMemo(() => ({
    wechat: en ? "WeChat" : "微信好友", moments: en ? "WeChat Moments" : "朋友圈", facebook: "Facebook", instagram: "Instagram", more: en ? "More" : "更多",
  }), [en]);

  useEffect(() => {
    let active = true;
    let url = "";
    void createShareCard(entry, locale).then((blob) => {
      if (!active) return;
      if (blob) { url = URL.createObjectURL(blob); setCardUrl(url); }
      setCard(blob);
      setPreparing(false);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [entry, locale]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function share(target: ShareTarget) {
    if (!card) return;
    const file = new File([card], `lifescale-${entry.entry_date}.png`, { type: "image/png" });
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
    downloadBlob(card, entry.entry_date);
    const targetName = copy[target];
    setStatus(en ? `The card was saved. Open ${targetName} and choose it to post.` : `分享卡已保存，请打开${targetName}并选择这张图片发布。`);
  }

  function saveCard() {
    if (!card) return;
    downloadBlob(card, entry.entry_date);
    setStatus(en ? "Share card saved." : "分享卡已保存到设备。");
  }

  return <div className="modal-backdrop share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label={en ? "Close" : "关闭"}>×</button>
      <p className="kicker">SHARE A DAY</p>
      <h2 id="share-dialog-title">{en ? "Share this day" : "分享这一天"}</h2>
      <p className="share-privacy">{en ? "Only the copy you confirm is shared. Your original entry stays private. The card contains no email, birth date or life target." : "只分享你确认的副本。原记录继续保持私密，分享卡不含邮箱、出生日期或人生目标。"}</p>
      <div className="share-card-preview-image">{cardUrl ? <Image src={cardUrl} alt={en ? "Preview of the share card" : "分享卡预览"} width={1080} height={1350} unoptimized /> : <span>{en ? "Preparing your share card…" : "正在生成分享卡…"}</span>}</div>
      <div className="share-platform-grid" aria-label={en ? "Share choices" : "分享方式"}>
        {(["wechat", "moments", "facebook", "instagram", "more"] as ShareTarget[]).map((target) => <button type="button" key={target} disabled={preparing} onClick={() => void share(target)}><b>{target === "wechat" ? "微" : target === "moments" ? "圈" : target === "facebook" ? "f" : target === "instagram" ? "◎" : "···"}</b><span>{copy[target]}</span></button>)}
      </div>
      <button className="outline-button share-save-button" type="button" disabled={preparing} onClick={saveCard}>{preparing ? (en ? "Preparing card…" : "正在生成分享卡…") : (en ? "Save share card" : "保存分享卡")}</button>
      {status ? <p className="share-status" role="status">{status}</p> : null}
      <p className="share-platform-note">{en ? "Available apps depend on your device. If a platform cannot be opened directly, LifeScale saves the card for you to post manually." : "可直接调用的平台由设备决定；无法直接打开指定平台时，会保存图片供你手动发布。"}</p>
    </section>
  </div>;
}
