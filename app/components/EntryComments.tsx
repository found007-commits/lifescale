"use client";
import { useRef, useState } from "react";
import { addComment, loadComments } from "../../lib/lifescale-data";
import type { EntryComment } from "../../lib/types";

export function EntryComments({ entryId, userId, en }: { entryId: string; userId: string; en: boolean }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<EntryComment[]>([]);
  const [text, setText] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [more, setMore] = useState(false);
  const [reply, setReply] = useState<EntryComment | null>(null);
  const pending = useRef(false), id = useRef<string | null>(null);
  async function load(append = false) {
    const data = await loadComments(entryId, append ? rows.length : 0);
    setRows(old => append ? [...old, ...data] : data); setMore(data.length === 30);
  }
  async function refresh(append = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await load(append); } catch { setError(en ? "Comments unavailable. Retry." : "留言加载失败，请重试。"); }
    finally { pending.current = false; setBusy(false); }
  }
  async function send() {
    if (pending.current || !text.trim()) return;
    pending.current = true; setBusy(true); setError(""); id.current ||= crypto.randomUUID();
    try {
      await addComment(entryId, userId, text, reply?.id || null, id.current);
      id.current = null; setText(""); setReply(null);
      await load();
    } catch { setError(en ? "Could not update comments. Retry." : "留言未能更新，请重试。"); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="entry-comments">
    <button aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void refresh(); }}>{en ? "Open · Leave a note" : "打开 · 留言"}</button>
    {open ? <div>
      <p>{en ? "A note to this day, only for you." : "给这一天留句话，仅自己可见。"}</p>
      {rows.map(row => <div className="comment" key={row.id}>{row.parent_id ? <small>{en ? "Reply" : "回复留言"}</small> : null}<p className="ignore-opencc">{row.content}</p><small>{new Date(row.created_at).toLocaleString()}</small><button disabled={busy} onClick={() => { id.current = null; setReply(row); }}>{en ? "Reply" : "回复"}</button></div>)}
      {more ? <button disabled={busy} onClick={() => void refresh(true)}>{en ? "More" : "加载更多"}</button> : null}
      {reply ? <blockquote className="ignore-opencc">{reply.content}<button disabled={busy} onClick={() => { id.current = null; setReply(null); }}>{en ? "Cancel reply" : "取消回复"}</button></blockquote> : null}
      <label>{en ? "Leave a note" : "后来的话"}<textarea value={text} disabled={busy} maxLength={2000} onChange={event => { id.current = null; setText(event.target.value); }} /></label>
      {error ? <p role="alert">{error}<button disabled={busy} onClick={() => void refresh()}>{en ? "Reload" : "刷新留言"}</button></p> : null}
      <button disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? (en ? "Saving…" : "正在保存…") : (en ? "Keep this note" : "留下这句话")}</button>
    </div> : null}
  </section>;
}
