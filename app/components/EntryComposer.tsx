"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createEntry, updateEntry, uploadEntryImage } from "../../lib/lifescale-data";
import { todayInTimeZone } from "../../lib/life-calculations";
import type { EntryCategory, LifeEntry, Locale, Mood } from "../../lib/types";
import { LARGE_IMAGE_BYTES } from "../../lib/prepare-image";
import { MEDIA_ACCEPT, prepareMedia } from "../../lib/prepare-media";
import { EDIT_NOTICE, EDIT_USED, canEdit, editChanged, editError } from "../../miniprogram/utils/edit-policy";
import t from "../../miniprogram/utils/locale-copy";

type PhotoChoice = { id: string; name: string; file?: File; url?: string; error?: string; uploaded?: boolean };

const prompts = ["今天值得记住的一件事是什么？", "今天你把时间给了谁？", "如果今天不能重来，你满意吗？", "明天最值得完成的一件事是什么？", "今天有什么事情让你感到感恩？"];
const moods: Array<[Mood, string]> = [["calm", "平静"], ["happy", "开心"], ["grateful", "感恩"], ["tired", "疲惫"], ["sad", "难过"], ["anxious", "焦虑"], ["hopeful", "充满希望"]];
const categories: Array<[EntryCategory, string]> = [["daily", "日常"], ["family", "家人"], ["work", "工作"], ["growth", "成长"], ["health", "健康"], ["travel", "旅行"], ["reflection", "感悟"], ["other", "其他"]];

export function EntryComposer({ userId, timezone, locale, entry, onClose, onSaved }: { userId: string; timezone: string; locale: Locale; entry?: LifeEntry | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState(entry?.content || "");
  const [mood, setMood] = useState<Mood>(entry?.mood || "calm");
  const [category, setCategory] = useState<EntryCategory>(entry?.category || "daily");
  const [photos, setPhotos] = useState<PhotoChoice[]>([]);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const entryId = useRef(entry?.id || crypto.randomUUID());
  const created = useRef(false);
  const editRequest = useRef({ id: "", payload: "" });
  const saving = useRef(false);
  const picking = useRef(false);
  const uploaded = useRef(new Set<string>());
  const urls = useRef(new Set<string>());
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = locale === "en";
  const prompt = en ? ["What is one thing worth remembering today?", "Who received your time today?", "If today could not be repeated, would it feel complete?", "What matters most tomorrow?", "What made you grateful today?"][new Date().getDate() % prompts.length] : prompts[new Date().getDate() % prompts.length];

  useEffect(() => {
    alive.current = true;
    const ownedUrls = urls.current;
    return () => { alive.current = false; ownedUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  async function choosePhotos(files: File[]) {
    if (entry || picking.current || saving.current || created.current) return;
    picking.current = true; setProcessing(true); setError("");
    if (files.some((file) => file.size > LARGE_IMAGE_BYTES)) setNotice(en ? "Large photos may take longer to prepare and upload. Please keep this window open." : "照片较大，处理和上传可能较慢，请保持页面打开。");
    for (const file of files) {
      if (!alive.current) break;
      const id = crypto.randomUUID();
      setPhotos((items) => [...items, { id, name: file.name }]);
      try {
        const prepared = await prepareMedia(file, en);
        if (!alive.current) break;
        const url = URL.createObjectURL(prepared); urls.current.add(url);
        setPhotos((items) => items.map((item) => item.id === id ? { ...item, file: prepared, url } : item));
      } catch (error) {
        if (alive.current) setPhotos((items) => items.map((item) => item.id === id ? { ...item, error: error instanceof Error ? error.message : "图片处理失败" } : item));
      }
    }
    picking.current = false;
    if (alive.current) setProcessing(false);
  }

  function removePhoto(photo: PhotoChoice) {
    if (busy || created.current) return;
    if (photo.url) { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); }
    setPhotos((items) => items.filter((item) => item.id !== photo.id));
  }

  async function save() {
    if (saving.current || picking.current) return;
    if (!content.trim() && !photos.length && !entry?.entry_media?.length) return setError(en ? "Write something or add a photo." : "请写下一句话或添加照片。");
    if (photos.some((photo) => !photo.file || photo.error)) return setError(en ? "Remove unreadable photos before saving." : "请先移除无法读取的图片，再保存。");
    saving.current = true;
    setBusy(true); setError("");
    try {
      if (entry && !created.current) {
        if (!canEdit(entry)) { setError(t(EDIT_USED, locale)); return; }
        const values = { content: content.trim(), mood, category, visibility: "private" as const };
        if (!editChanged(entry, values)) { onClose(); return; }
        if (!window.confirm(t(EDIT_NOTICE, locale))) return;
        const payload = JSON.stringify(values);
        if (editRequest.current.payload !== payload) editRequest.current = { id: crypto.randomUUID(), payload };
        await updateEntry(entry.id, userId, values, editRequest.current.id);
      } else if (!created.current) {
        await createEntry({ id: entryId.current, userId, entryDate: new Date().toISOString(), content: content.trim(), mood, category, visibility: "private", checkinDate: todayInTimeZone(timezone) });
      }
      created.current = true;
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        if (uploaded.current.has(photo.id)) continue;
        setProgress(en ? `Uploading photo ${index + 1} of ${photos.length}…` : `正在上传第 ${index + 1} / ${photos.length} 张照片…`);
        await uploadEntryImage(userId, entryId.current, photo.file!, photo.id);
        uploaded.current.add(photo.id);
        setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, uploaded: true } : item));
      }
      await onSaved();
      onClose();
    } catch (caught) {
      const reason = entry ? t(editError(caught instanceof Error ? caught : {}), locale) : caught instanceof Error ? caught.message : "保存失败，请稍后再试。";
      setError(reason + (created.current ? (en ? " Your entry and completed photos are kept. Retry to continue the remaining uploads." : " 记录和已上传的照片已保留，点击重试继续剩余上传，不会重复创建记录。") : ""));
    } finally { saving.current = false; if (alive.current) { setBusy(false); setProgress(""); } }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && !processing && event.target === event.currentTarget) onClose(); }}>
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <button className="modal-close" disabled={busy || processing} onClick={onClose} aria-label={en ? "Close" : "关闭"}>×</button>
        <p className="kicker">TODAY +1</p><h2 id="composer-title">{entry ? (en ? "Edit this day" : "编辑这一天") : (en ? "Today is worth keeping." : "今天，也值得被记住。")}</h2>
        <p className="daily-prompt">{prompt}</p>
        {entry ? <p className="upload-hint">{t(canEdit(entry) ? "可修改正文、心情和分类，已保存的影像保持不变。" : EDIT_USED, locale)}</p> : null}
        <label>{en ? "Write one sentence, or a little more" : "写下一句话，或多写一点"}<textarea disabled={busy || created.current} rows={6} maxLength={12000} value={content} onChange={(event) => setContent(event.target.value)} placeholder={en ? "What happened? What do you want to remember?" : "此刻发生了什么？你想记住什么？"} /></label>
        <div className="composer-row"><label>{en ? "Mood" : "此刻的心情"}<select disabled={busy || created.current} value={mood} onChange={(event) => setMood(event.target.value as Mood)}>{moods.map(([value, label]) => <option value={value} key={value}>{en ? ({ calm: "Calm", happy: "Happy", grateful: "Grateful", tired: "Tired", sad: "Sad", anxious: "Anxious", hopeful: "Hopeful" } as Record<Mood, string>)[value] : label}</option>)}</select></label><label>{en ? "Category" : "分类"}<select disabled={busy || created.current} value={category} onChange={(event) => setCategory(event.target.value as EntryCategory)}>{categories.map(([value, label]) => <option value={value} key={value}>{en ? ({ daily: "Daily", family: "Family", work: "Work", growth: "Growth", health: "Health", travel: "Travel", reflection: "Reflection", other: "Other" } as Record<EntryCategory, string>)[value] : label}</option>)}</select></label></div>
        {!entry ? <label>{en ? "Choose from this device · photos, GIFs or videos" : "从本机选择图片、GIF 或视频 · 可多选"}<input type="file" multiple accept={MEDIA_ACCEPT} disabled={busy || processing || created.current} onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void choosePhotos(files); }} /></label> : null}
        <p className="upload-hint">{en ? "Words are optional. GIFs keep their animation. MP4 / MOV videos load only when opened, never autoplay. Files must be within 50 MB after processing; long videos are not trimmed. Photo formats depend on your device." : "可以只留影像，不必写字。GIF 保留动画；MP4 / MOV 视频点开再加载，不自动播放。单个文件处理后需在 50 MB 以内，不会截短视频。图片格式以设备支持为准。"}</p>
        {notice ? <p className="upload-hint" role="status">{notice}</p> : null}
        <div className="photo-choice-grid">
          {photos.map((photo, index) => <div key={photo.id} className="photo-choice">
            {photo.file?.type.startsWith("video/") ? <span className="media-placeholder">▶ {en ? "Video selected" : "视频已选好"}</span> : photo.url ? <Image src={photo.url} width={180} height={140} unoptimized alt={`${en ? "Selected photo" : "已选照片"} ${index + 1}`} /> : <span>{photo.error || (en ? "Preparing…" : "正在处理…")}</span>}
            <small className="ignore-opencc">{index + 1}. {photo.name}</small>
            <button type="button" disabled={busy || created.current} onClick={() => removePhoto(photo)}>{photo.uploaded ? (en ? "Uploaded" : "已上传") : (en ? "Remove" : "移除")}</button>
          </div>)}
        </div>
        <p className="privacy-hint private-only">{en ? "Only you can view this record and its image. There is no public option." : "这条记录和图片仅你本人可见，不提供公开选项。"}</p>
        {error ? <p className="form-status" role="status">{error}</p> : null}
        <button className="primary-button composer-submit" disabled={busy || processing || photos.some((photo) => !photo.file)} onClick={save}>{processing ? (en ? "Preparing photos…" : "正在处理照片…") : busy ? progress || (en ? "Saving…" : "正在保存…") : created.current ? (en ? "Retry remaining uploads" : "重试剩余上传") : entry ? (en ? "Save changes" : "保存修改") : (en ? "Record Today +1" : "记录今天 +1")}</button>
      </section>
    </div>
  );
}
