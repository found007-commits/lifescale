"use client";

import { useState } from "react";
import { createEntry, updateEntry, uploadEntryImage } from "../../lib/lifescale-data";
import { todayInTimeZone } from "../../lib/life-calculations";
import type { EntryCategory, LifeEntry, Locale, Mood } from "../../lib/types";

const prompts = ["今天值得记住的一件事是什么？", "今天你把时间给了谁？", "如果今天不能重来，你满意吗？", "明天最值得完成的一件事是什么？", "今天有什么事情让你感到感恩？"];
const moods: Array<[Mood, string]> = [["calm", "平静"], ["happy", "开心"], ["grateful", "感恩"], ["tired", "疲惫"], ["sad", "难过"], ["anxious", "焦虑"], ["hopeful", "充满希望"]];
const categories: Array<[EntryCategory, string]> = [["daily", "日常"], ["family", "家人"], ["work", "工作"], ["growth", "成长"], ["health", "健康"], ["travel", "旅行"], ["reflection", "感悟"], ["other", "其他"]];

export function EntryComposer({ userId, timezone, locale, entry, onClose, onSaved }: { userId: string; timezone: string; locale: Locale; entry?: LifeEntry | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState(entry?.content || "");
  const [mood, setMood] = useState<Mood>(entry?.mood || "calm");
  const [category, setCategory] = useState<EntryCategory>(entry?.category || "daily");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = locale === "en";
  const prompt = en ? ["What is one thing worth remembering today?", "Who received your time today?", "If today could not be repeated, would it feel complete?", "What matters most tomorrow?", "What made you grateful today?"][new Date().getDate() % prompts.length] : prompts[new Date().getDate() % prompts.length];

  async function save() {
    setBusy(true); setError("");
    try {
      let entryId = entry?.id;
      if (entry) {
        await updateEntry(entry.id, userId, { content: content.trim(), mood, category, visibility: "private" });
      } else {
        const created = await createEntry({ userId, entryDate: new Date().toISOString(), content: content.trim(), mood, category, visibility: "private", checkinDate: todayInTimeZone(timezone) });
        entryId = created.id;
      }
      if (file && entryId) await uploadEntryImage(userId, entryId, file);
      await onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败，请稍后再试。");
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <button className="modal-close" onClick={onClose} aria-label={en ? "Close" : "关闭"}>×</button>
        <p className="kicker">TODAY +1</p><h2 id="composer-title">{entry ? (en ? "Edit this day" : "编辑这一天") : (en ? "Today is worth keeping." : "今天，也值得被记住。")}</h2>
        <p className="daily-prompt">{prompt}</p>
        <label>{en ? "Write one sentence, or a little more" : "写下一句话，或多写一点"}<textarea rows={6} maxLength={12000} value={content} onChange={(event) => setContent(event.target.value)} placeholder={en ? "What happened? What do you want to remember?" : "此刻发生了什么？你想记住什么？"} /></label>
        <div className="composer-row"><label>{en ? "Mood" : "此刻的心情"}<select value={mood} onChange={(event) => setMood(event.target.value as Mood)}>{moods.map(([value, label]) => <option value={value} key={value}>{en ? ({ calm: "Calm", happy: "Happy", grateful: "Grateful", tired: "Tired", sad: "Sad", anxious: "Anxious", hopeful: "Hopeful" } as Record<Mood, string>)[value] : label}</option>)}</select></label><label>{en ? "Category" : "分类"}<select value={category} onChange={(event) => setCategory(event.target.value as EntryCategory)}>{categories.map(([value, label]) => <option value={value} key={value}>{en ? ({ daily: "Daily", family: "Family", work: "Work", growth: "Growth", health: "Health", travel: "Travel", reflection: "Reflection", other: "Other" } as Record<EntryCategory, string>)[value] : label}</option>)}</select></label></div>
        <label>{en ? "Image (up to 10 MB)" : "图片（最多 10 MB）"}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <p className="privacy-hint private-only">{en ? "Only you can view this record and its image. There is no public option." : "这条记录和图片仅你本人可见，不提供公开选项。"}</p>
        {error ? <p className="form-status" role="status">{error}</p> : null}
        <button className="primary-button composer-submit" disabled={busy} onClick={save}>{busy ? (en ? "Saving…" : "正在保存…") : entry ? (en ? "Save changes" : "保存修改") : (en ? "Record Today +1" : "记录今天 +1")}</button>
      </section>
    </div>
  );
}
