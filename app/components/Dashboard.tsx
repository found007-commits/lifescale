"use client";

import type { CSSProperties } from "react";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "../../lib/auth-client";
import { calculateLifeMetrics } from "../../lib/life-calculations";
import { deleteEntry, loadLifeScaleData, updateProfile } from "../../lib/lifescale-data";
import { getJourneyPrompt } from "../../lib/journey-prompts";
import { calculateStreak } from "../../lib/report-calculations";
import type { Checkin, GenderOption, LifeEntry, LifeProfile, Locale } from "../../lib/types";
import { useTheme } from "../../lib/use-theme";
import { useTraditionalChinese } from "../../lib/use-traditional-chinese";
import { Brand } from "./Brand";
import { CoreTargetEditor } from "./CoreTargetEditor";
import { EntryComposer } from "./EntryComposer";
import { GenderSelector } from "./GenderSelector";
import { Onboarding } from "./Onboarding";
import { ReportView } from "./ReportView";

type Tab = "home" | "history" | "report" | "profile";
const moodLabels: Record<string, string> = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels: Record<string, string> = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

export function Dashboard({ session, initialLocale }: { session: Session; initialLocale: Locale }) {
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [entries, setEntries] = useState<LifeEntry[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LifeEntry | null>(null);
  const [toast, setToast] = useState("");
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [genderChoice, setGenderChoice] = useState<GenderOption | null>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const { theme, setTheme } = useTheme();
  const surfaceLocale: Locale = profile?.locale === "en" || profile?.locale === "zh-TW" ? profile.locale : profile ? "zh" : initialLocale;
  useTraditionalChinese(surfaceRef, surfaceLocale);

  const refresh = useCallback(async () => {
    try {
      const data = await loadLifeScaleData(session.user.id);
      setProfile(data.profile); setEntries(data.entries); setCheckins(data.checkins); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "无法加载云端数据。"); }
  }, [session.user.id]);

  useEffect(() => {
    let active = true;
    void loadLifeScaleData(session.user.id).then((data) => {
      if (!active) return;
      setProfile(data.profile); setEntries(data.entries); setCheckins(data.checkins); setError("");
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "无法加载云端数据。");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.user.id]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!deleteStep) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !deletingAccount) setDeleteStep(0); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteStep, deletingAccount]);

  const metrics = useMemo(() => profile ? calculateLifeMetrics({ birthDate: profile.birth_date, targetAge: profile.target_age, targetDate: profile.target_date, timeZone: profile.timezone }) : null, [profile]);
  const streak = metrics ? calculateStreak(checkins, metrics.today) : 0;
  const checkedToday = Boolean(metrics && checkins.some((item) => item.checkin_date === metrics.today));

  if (loading) return <main className="app-loading full"><Brand /><p>正在同步你的 LifeScale…</p></main>;
  if (error && !profile) return <main className="app-loading full"><Brand /><p>{error}</p><button className="outline-button" onClick={() => { setLoading(true); void refresh().finally(() => setLoading(false)); }}>重新加载</button></main>;
  if (!profile) return <Onboarding session={session} initialLocale={initialLocale} onComplete={(next) => { setProfile(next); setTab("home"); }} />;
  if (!metrics) return <main className="app-loading full">无法计算余生刻度，请检查核心资料。</main>;

  const activeProfile = profile;
  const activeMetrics = metrics;
  const locale: Locale = activeProfile.locale === "en" || activeProfile.locale === "zh-TW" ? activeProfile.locale : "zh";
  const en = locale === "en";
  const journeyPrompt = getJourneyPrompt(checkins.length, checkedToday, locale);
  const displayName = activeProfile.display_name || session.user.email?.split("@")[0] || "LifeScale";
  const ringStyle = { "--progress": `${Math.max(3, activeMetrics.progressPercent * 3.6)}deg` } as CSSProperties;

  async function setDisplayMode(next: "gentle" | "clear") {
    if (next === activeProfile.display_mode) return;
    try { setProfile(await updateProfile(activeProfile.id, { display_mode: next })); } catch (caught) { setToast(caught instanceof Error ? caught.message : "切换失败。"); }
  }

  async function remove(entry: LifeEntry) {
    if (!window.confirm(en ? "Delete this entry and its images? This cannot be undone." : "确定删除这条记录及其图片吗？此操作无法撤销。")) return;
    try { await deleteEntry(entry); await refresh(); setToast(en ? "Entry deleted." : "记录已删除。"); } catch (caught) { setToast(caught instanceof Error ? caught.message : (en ? "Could not delete the entry." : "删除失败。")); }
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const updated = await updateProfile(activeProfile.id, { display_name: String(data.get("display_name") || "").trim() || null, gender_identity: genderChoice || activeProfile.gender_identity, locale: String(data.get("locale")) as Locale, timezone: String(data.get("timezone")), display_mode: String(data.get("display_mode")) as "gentle" | "clear" });
      setProfile(updated); setGenderChoice(null); window.localStorage.setItem("lifescale:locale", updated.locale); setToast(en ? "Preferences saved." : "个人资料已保存。");
    } catch (caught) { setToast(caught instanceof Error ? caught.message : (en ? "Could not save your preferences." : "保存失败。")); }
  }

  function exportData() {
    const safeEntries = entries.map(({ entry_media, ...entry }) => ({ ...entry, media: (entry_media || []).map((media) => ({ id: media.id, entry_id: media.entry_id, user_id: media.user_id, storage_path: media.storage_path, media_type: media.media_type, created_at: media.created_at })) }));
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: activeProfile, entries: safeEntries, checkins }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `lifescale-export-${activeMetrics.today}.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  function requestAccountDeletion() {
    setDeleteError("");
    setDeleteStep(1);
  }

  async function confirmAccountDeletion() {
    if (deleteStep === 1) { setDeleteStep(2); return; }
    if (deleteStep !== 2 || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/account/delete", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) {
        setDeleteError(en ? "Account deletion failed. Please try again shortly." : "注销失败，请稍后重试。");
        return;
      }
      await signOut();
      window.location.reload();
    } catch {
      setDeleteError(en ? "The network is unavailable. Please try again." : "网络暂时不可用，请重试。");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <main className="app-shell" key={locale} ref={surfaceRef} lang={locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : "en"}>
      <aside className="app-sidebar"><Brand /><p className="sidebar-promise">{en ? "See the life ahead. Make today count." : "看见余生，认真今天。"}</p><nav aria-label={en ? "Product navigation" : "产品导航"}><button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><span>◌</span>{en ? "Life scale" : "余生刻度"}</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><span>＋</span>{en ? "Journal" : "人生记录"}</button><button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}><span>↗</span>{en ? "7-day report" : "7天报告"}</button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><span>○</span>{en ? "Profile & data" : "个人与数据"}</button></nav><a className="brand-site-link" href="https://lifescale.space">{en ? "Brand website" : "返回品牌官网"} ↗</a><button className="sidebar-account" onClick={() => setTab("profile")}><b className="ignore-opencc">{displayName.slice(0, 1).toUpperCase()}</b><span className="ignore-opencc"><strong>{displayName}</strong><small>{session.user.email}</small></span></button></aside>

      <div className="app-workspace">
        <header className="workspace-header">
          <div><strong>{tab === "home" ? (en ? "My life scale" : "我的余生刻度") : tab === "history" ? (en ? "Life journal" : "人生记录") : tab === "report" ? (en ? "7-day report" : "7天报告") : (en ? "Profile & data" : "个人与数据")}</strong><small>{en ? "Cloud synced" : "云端同步"} · {profile.timezone}</small></div>
          <div className="workspace-actions">
            <button className="theme-button" aria-label={en ? "Toggle theme" : "切换主题"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "◐" : "☼"}</button>
            <div className="display-mode-control" role="group" aria-label={en ? "Choose display mode" : "选择显示模式"}>
              <span>{en ? "Display" : "显示方式"}</span>
              <button type="button" className={profile.display_mode === "gentle" ? "active" : ""} aria-pressed={profile.display_mode === "gentle"} onClick={() => void setDisplayMode("gentle")}>{en ? "Gentle" : "温和模式"}</button>
              <button type="button" className={profile.display_mode === "clear" ? "active" : ""} aria-pressed={profile.display_mode === "clear"} onClick={() => void setDisplayMode("clear")}>{en ? "Clear" : "清醒模式"}</button>
            </div>
            <button className="primary-button" onClick={() => { setEditingEntry(null); setComposerOpen(true); }}>{en ? "Record today +1" : "记录今天 +1"}</button>
          </div>
        </header>

        {tab === "home" ? <section className={`journey-reminder-shell ${journeyPrompt.day === 100 ? "milestone" : ""}`} aria-live="polite"><div className="journey-reminder"><span>{journeyPrompt.label}</span><div><h2>{journeyPrompt.title}</h2><p>{journeyPrompt.body}</p></div>{!checkedToday ? <button type="button" onClick={() => { setEditingEntry(null); setComposerOpen(true); }}>{en ? "Keep today" : "留下今天"} →</button> : null}</div></section> : null}

        {tab === "home" ? <section className={`dashboard-page ${profile.display_mode}-mode`}><header className="dashboard-intro"><p className="kicker">TODAY · {metrics.today}</p><h1>{metrics.isBonusChapter ? (en ? "Bonus time. Another day gained." : "生命加时，今天又赚到一天。") : (en ? "Today is worth remembering." : "今天，也值得被记住。")}</h1><p>{en ? "This is a life-time goal you set for yourself, never a death prediction." : "这不是死亡预测，而是你为自己设定的人生时间目标。"}</p></header><div className="life-focus"><div className="life-dial" style={ringStyle}><div className="life-dial-inner"><small>{metrics.isBonusChapter ? (en ? "BONUS TIME" : "生命加时") : profile.display_mode === "gentle" ? (en ? "YOURS TO WRITE" : "仍可书写") : (en ? "DAYS LEFT" : "剩余天数")}</small><strong>{(metrics.isBonusChapter ? metrics.bonusDays : metrics.remainingDays).toLocaleString()}</strong><span>{metrics.isBonusChapter ? "BONUS DAYS" : "DAYS"}</span></div></div><div className="life-summary"><p>{metrics.isBonusChapter ? (en ? "Your target date has passed. LifeScale is now adding every day you live." : "目标日期已经走过，LifeScale 正在为你正向累计每一天。") : (en ? `${metrics.remainingYears} years, ${metrics.remainingMonths} months and ${metrics.remainingRemainderDays} days to your goal.` : `距目标还有 ${metrics.remainingYears} 年 ${metrics.remainingMonths} 个月 ${metrics.remainingRemainderDays} 天。`)}</p><dl><div><dt>{en ? "Days lived" : "已走过"}</dt><dd>{metrics.livedDays.toLocaleString()} {en ? "days" : "天"}</dd></div><div><dt>{en ? "Life progress" : "生命进度"}</dt><dd>{metrics.progressPercent.toFixed(2)}%</dd></div><div><dt>{en ? "Weeks left" : "剩余周数"}</dt><dd>{metrics.remainingWeeks.toLocaleString()} {en ? "weeks" : "周"}</dd></div><div><dt>{en ? "Next birthday" : "下次生日"}</dt><dd>{en ? `in ${metrics.nextBirthdayDays} days` : `${metrics.nextBirthdayDays} 天后`}</dd></div></dl><button className={`today-checkin ${checkedToday ? "done" : ""}`} onClick={() => { setEditingEntry(null); setComposerOpen(true); }}><span>{checkedToday ? "✓" : "+1"}</span><strong>{checkedToday ? (en ? "Today is already recorded" : "今天已经留下记录") : (en ? "Record today +1" : "记录今天 +1")}</strong><small>{checkedToday ? (en ? `${streak}-day streak · ${checkins.length} total days` : `连续 ${streak} 天 · 累计 ${checkins.length} 天`) : (en ? "One sentence or one photo is enough" : "一句话、一张图，也足够")}</small></button></div></div><section className="recent-section"><div className="section-bar"><div><p className="kicker">RECENT DAYS</p><h2>{en ? "Days you have kept" : "最近留下的日子"}</h2></div><button className="change-email" onClick={() => setTab("history")}>{en ? "View all" : "查看全部"} →</button></div>{entries.length ? <div className="recent-row">{entries.slice(0, 3).map((entry) => <EntryCard entry={entry} locale={locale} key={entry.id} />)}</div> : <div className="recent-empty"><strong>{en ? "Your first entry starts today." : "你的第一条记录，会从今天开始。"}</strong><button className="primary-button" onClick={() => setComposerOpen(true)}>{en ? "Record today +1" : "记录今天 +1"}</button></div>}</section></section> : null}

        {tab === "history" ? <section className="workspace-page"><header className="section-heading"><div><p className="kicker">LIFE JOURNAL</p><h1>{en ? "These days did not pass for nothing." : "这些日子，都没有白白经过。"}</h1></div><button className="primary-button" onClick={() => { setEditingEntry(null); setComposerOpen(true); }}>{en ? "New entry" : "新建记录"}</button></header>{entries.length ? <div className="records-grid">{entries.map((entry) => <article className="record-card" key={entry.id}><EntryCard entry={entry} locale={locale} /><div className="record-actions"><button onClick={() => { setEditingEntry(entry); setComposerOpen(true); }}>{en ? "Edit" : "编辑"}</button><button onClick={() => void remove(entry)}>{en ? "Delete" : "删除"}</button></div></article>)}</div> : <div className="empty-state"><strong>{en ? "No entries yet" : "还没有记录"}</strong><p>{en ? "You do not need a long journal. One honest sentence is enough." : "不必写长日记，留下一句话就可以。"}</p><button className="primary-button" onClick={() => setComposerOpen(true)}>{en ? "Record today +1" : "记录今天 +1"}</button></div>}</section> : null}

        {tab === "report" ? <ReportView profile={profile} entries={entries} checkins={checkins} locale={locale} /> : null}

        {tab === "profile" ? <section className="workspace-page"><header className="section-heading"><div><p className="kicker">PROFILE & DATA</p><h1>{en ? "Your profile. Your data." : "你的资料，你的数据。"}</h1></div></header><div className="settings-grid"><CoreTargetEditor profile={profile} onUpdated={setProfile} /><section className="settings-card"><h2>{en ? "Preferences" : "个人偏好"}</h2><form onSubmit={savePreferences}><label>{en ? "Display name" : "显示名称"}<input name="display_name" defaultValue={profile.display_name || ""} maxLength={80} /></label><GenderSelector locale={locale} value={genderChoice || activeProfile.gender_identity} onChange={setGenderChoice} /><label>{en ? "Language" : "语言"}<select name="locale" defaultValue={profile.locale}><option value="zh">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label><label>{en ? "Time zone" : "时区"}<input name="timezone" defaultValue={profile.timezone} /></label><label>{en ? "Display mode" : "显示模式"}<select name="display_mode" defaultValue={profile.display_mode}><option value="gentle">{en ? "Gentle" : "温和模式"}</option><option value="clear">{en ? "Clear" : "清醒模式"}</option></select></label><button className="primary-button settings-wide-button">{en ? "Save preferences" : "保存个人资料"}</button></form></section><section className="settings-card account-card"><h2>{en ? "Privacy & data" : "隐私与数据"}</h2><p>{en ? "Records and images are visible only to you. The product has no creator or operations console for browsing or editing private content; identity and row-level permissions protect every request." : "记录与图片仅你本人可见。产品内没有供创作者或运营人员浏览、修改私密内容的后台入口；每次访问都经过身份与行级权限校验。"}</p><button className="settings-action" onClick={exportData}><span>{en ? "Export all data" : "导出全部数据"}</span><b>JSON ↓</b></button><a className="settings-action" href="/privacy"><span>{en ? "Privacy notice" : "隐私说明"}</span><b>→</b></a><a className="settings-action" href="/terms"><span>{en ? "Terms" : "用户协议"}</span><b>→</b></a><a className="settings-action" href="/third-parties"><span>{en ? "Third-party services" : "第三方服务清单"}</span><b>→</b></a><button className="settings-action" onClick={() => void signOut()}><span>{en ? "Sign out" : "退出登录"}</span><b>→</b></button><button className="settings-action danger" onClick={requestAccountDeletion}><span>{en ? "Permanently delete account and data" : "永久注销账号并删除数据"}</span><b>×</b></button></section></div></section> : null}
      </div>
      {deleteStep ? <div className="modal-backdrop danger-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingAccount) setDeleteStep(0); }}><section className="danger-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description"><span className="danger-confirm-kicker">{en ? "ACCOUNT & DATA" : "账号与数据"}</span><h2 id="delete-dialog-title">{deleteStep === 1 ? (en ? "Delete your account?" : "确定注销账号？") : (en ? "One final confirmation" : "请做最后一次确认")}</h2><p id="delete-dialog-description">{deleteStep === 1 ? (en ? "Your account, cloud records and images will be permanently deleted." : "账号、云端记录和图片都将被永久删除。") : (en ? "This action cannot be undone. After deletion, none of this data can be recovered." : "此操作无法撤销，注销后所有数据均无法恢复。")}</p>{deleteError ? <p className="danger-confirm-error" role="alert">{deleteError}</p> : null}<div className="danger-confirm-actions"><button type="button" className="outline-button" onClick={() => setDeleteStep(0)} disabled={deletingAccount}>{en ? "Cancel" : "取消"}</button><button type="button" className="danger-confirm-button" onClick={() => void confirmAccountDeletion()} disabled={deletingAccount}>{deleteStep === 1 ? (en ? "Continue" : "继续") : deletingAccount ? (en ? "Deleting..." : "正在注销...") : (en ? "Delete permanently" : "确认永久注销")}</button></div></section></div> : null}
      {composerOpen ? <EntryComposer userId={profile.id} timezone={profile.timezone} locale={locale} entry={editingEntry} onClose={() => { setComposerOpen(false); setEditingEntry(null); }} onSaved={async () => { await refresh(); setToast(en ? "Today did not simply pass. You kept it." : "今天没有只是过去，而是被你留下了。"); }} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}

function EntryCard({ entry, locale }: { entry: LifeEntry; locale: Locale }) {
  const en = locale === "en";
  const mood = en ? { calm: "Calm", happy: "Happy", grateful: "Grateful", tired: "Tired", sad: "Sad", anxious: "Anxious", hopeful: "Hopeful" }[entry.mood] : moodLabels[entry.mood];
  const category = en ? { daily: "Daily life", family: "Family", work: "Work", growth: "Growth", health: "Health", travel: "Travel", reflection: "Reflection", other: "Other" }[entry.category] : categoryLabels[entry.category];
  return <article className="entry-card"><div className="entry-meta"><span>{new Date(entry.entry_date).toLocaleDateString(en ? "en-US" : locale === "zh-TW" ? "zh-TW" : "zh-CN", { month: "long", day: "numeric", weekday: "short" })}</span><span>{en ? "Only me" : "仅自己可见"}</span></div>{entry.entry_media?.[0]?.signed_url ? <Image src={entry.entry_media[0].signed_url} alt={en ? "Journal image" : "记录图片"} width={720} height={480} unoptimized /> : null}<p className="ignore-opencc">{entry.content || (en ? "Today +1" : "今天 +1")}</p><div className="entry-tags"><span>{mood}</span><span>{category}</span></div></article>;
}
