"use client";

import { useEffect, useMemo, useState } from "react";
import { authClient } from "../../lib/auth-client";
import { Brand } from "./Brand";

type Profile = { birthDate: string | null; targetAge: number; locale: string; country: string | null; timezone: string };
type LifeRecord = { id: string; title: string; content: string; mood: string; occurredOn: string; createdAt?: string };

function daysRemaining(profile: Profile | null) {
  if (!profile?.birthDate) return null;
  const end = new Date(`${profile.birthDate}T12:00:00`);
  end.setFullYear(end.getFullYear() + profile.targetAge);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
}

export function Dashboard({ session }: { session: { user: { name: string; email: string; image?: string | null } } }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<LifeRecord[]>([]);
  const [tab, setTab] = useState<"today" | "moments" | "settings">("today");
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ title: "", content: "", mood: "calm", occurredOn: new Date().toISOString().slice(0, 10) });
  const [settings, setSettings] = useState({ birthDate: "", targetAge: 90, locale: "en", country: "", timezone: "UTC" });

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json() as Promise<{ profile: Profile }>),
      fetch("/api/records").then((r) => r.json() as Promise<{ records: LifeRecord[] }>),
    ])
      .then(([p, r]) => {
        setProfile(p.profile);
        setSettings({
          birthDate: p.profile.birthDate ?? "",
          targetAge: p.profile.targetAge ?? 90,
          locale: p.profile.locale ?? "en",
          country: p.profile.country ?? "",
          timezone: p.profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setRecords(r.records ?? []);
      }).finally(() => setLoading(false));
  }, []);

  const remaining = useMemo(() => daysRemaining(profile), [profile]);
  const livedDays = profile?.birthDate ? Math.max(0, Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / 86_400_000)) : 0;
  const progress = remaining === null ? 0.34 : Math.min(0.99, livedDays / Math.max(1, livedDays + remaining));

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
    if (response.ok) { setProfile({ ...settings, birthDate: settings.birthDate || null, country: settings.country || null }); setNotice("Your LifeScale has been updated."); }
  }

  async function saveMoment(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { record: LifeRecord };
    if (response.ok) { setRecords((current) => [result.record, ...current]); setDraft({ ...draft, title: "", content: "" }); setComposer(false); setNotice("This moment is safely kept."); }
  }

  async function removeRecord(id: string) {
    if (!confirm("Delete this moment? This cannot be undone.")) return;
    const response = await fetch(`/api/records?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setRecords((current) => current.filter((record) => record.id !== id));
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your LifeScale account and every saved moment?")) return;
    if (!confirm("This cannot be undone. Delete everything now?")) return;
    const response = await fetch("/api/account/delete", { method: "POST" });
    if (response.ok) window.location.href = "/";
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <Brand compact />
        <nav className="app-nav" aria-label="App navigation">
          <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
          <button className={tab === "moments" ? "active" : ""} onClick={() => setTab("moments")}>Moments</button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>Settings</button>
        </nav>
        <button className="avatar-button" onClick={() => setTab("settings")} aria-label="Open settings">
          {session.user.image ? <img src={session.user.image} alt="" /> : session.user.name.slice(0, 1).toUpperCase()}
        </button>
      </header>

      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
      {loading ? <div className="app-loading">Preparing your time…</div> : null}

      {!loading && tab === "today" && (
        <section className="today-grid">
          <div className="today-copy">
            <p className="kicker">THURSDAY · A DAY OF YOUR OWN</p>
            <h1>Good morning,<br /><em>{session.user.name.split(" ")[0]}.</em></h1>
            <p>Today doesn’t need to be extraordinary to matter.</p>
            <button className="primary-button large" onClick={() => setComposer(true)}>＋ Keep this moment</button>
          </div>
          <div className="life-dial-card">
            <div className="life-dial" style={{ "--progress": `${progress * 360}deg` } as React.CSSProperties}>
              <div className="life-dial-inner">
                <span>{remaining === null ? "—" : remaining.toLocaleString()}</span>
                <small>{remaining === null ? "set your birth date" : "days to shape"}</small>
              </div>
            </div>
            {remaining === null ? (
              <button className="text-button" onClick={() => setTab("settings")}>Set up your LifeScale →</button>
            ) : <p className="dial-caption">You have already lived <strong>{livedDays.toLocaleString()}</strong> days. This one is yours too.</p>}
          </div>
          <aside className="latest-card">
            <p className="kicker">RECENT LIGHT</p>
            {records[0] ? <><h2>{records[0].title}</h2><p>{records[0].content || "A moment worth remembering."}</p><time>{records[0].occurredOn}</time></> : <><h2>Your first page is waiting.</h2><p>Keep one detail from today — a sentence is enough.</p></>}
          </aside>
        </section>
      )}

      {!loading && tab === "moments" && (
        <section className="moments-view">
          <div className="section-heading"><div><p className="kicker">YOUR PRIVATE ARCHIVE</p><h1>Moments that stayed.</h1></div><button className="primary-button" onClick={() => setComposer(true)}>＋ New moment</button></div>
          {records.length === 0 ? <div className="empty-state"><span>○</span><h2>Nothing has to be big to belong here.</h2><p>Save a thought, a person, a place, or one good thing from today.</p><button onClick={() => setComposer(true)}>Keep my first moment</button></div> : (
            <div className="records-grid">{records.map((record) => <article className={`record-card mood-${record.mood}`} key={record.id}><div className="record-top"><time>{record.occurredOn}</time><button onClick={() => removeRecord(record.id)} aria-label="Delete moment">×</button></div><h2>{record.title}</h2><p>{record.content}</p><span className="mood-label">{record.mood}</span></article>)}</div>
          )}
        </section>
      )}

      {!loading && tab === "settings" && (
        <section className="settings-view">
          <div className="section-heading"><div><p className="kicker">YOUR LIFESCALE</p><h1>Make it yours.</h1></div></div>
          <div className="settings-grid">
            <form className="settings-card" onSubmit={saveProfile}>
              <h2>Life horizon</h2><p>Choose the horizon that feels meaningful to you. This is a personal reflection, not a prediction.</p>
              <label>Birth date<input type="date" value={settings.birthDate} onChange={(e) => setSettings({ ...settings, birthDate: e.target.value })} /></label>
              <label>Life horizon<select value={settings.targetAge} onChange={(e) => setSettings({ ...settings, targetAge: Number(e.target.value) })}>{[70, 75, 80, 85, 90, 95, 100].map((age) => <option key={age} value={age}>{age} years</option>)}</select></label>
              <label>Language<select value={settings.locale} onChange={(e) => setSettings({ ...settings, locale: e.target.value })}><option value="en">English</option><option value="zh">简体中文</option><option value="es">Español</option><option value="ja">日本語</option></select></label>
              <button className="primary-button" type="submit">Save changes</button>
            </form>
            <div className="settings-card account-card">
              <h2>Account & data</h2><p>{session.user.email}</p>
              <a className="settings-action" href="/api/account/export">Download my data <span>↓</span></a>
              <a className="settings-action" href="/privacy">Read privacy notice <span>→</span></a>
              <a className="settings-action" href="/third-parties">Third-party services <span>→</span></a>
              <button className="settings-action" onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}>Sign out <span>→</span></button>
              <button className="delete-action" onClick={deleteAccount}>Permanently delete account</button>
            </div>
          </div>
        </section>
      )}

      {composer && <div className="modal-backdrop" role="presentation"><form className="composer" onSubmit={saveMoment}><button className="modal-close" type="button" onClick={() => setComposer(false)}>×</button><p className="kicker">KEEP THIS MOMENT</p><h2>What would you like to remember?</h2><label>Title<input autoFocus required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="A small detail from today" /></label><label>In your own words<textarea maxLength={4000} rows={5} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="What made it worth keeping?" /></label><div className="composer-row"><label>Date<input type="date" value={draft.occurredOn} onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })} /></label><label>Feeling<select value={draft.mood} onChange={(e) => setDraft({ ...draft, mood: e.target.value })}><option value="bright">Bright</option><option value="calm">Calm</option><option value="tender">Tender</option><option value="heavy">Heavy</option></select></label></div><button className="primary-button large" type="submit">Keep this moment</button></form></div>}
    </main>
  );
}
