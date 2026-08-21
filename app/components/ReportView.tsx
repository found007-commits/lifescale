"use client";

import { useMemo, useState } from "react";
import { buildSevenDayReport } from "../../lib/report-calculations";
import { saveSevenDayReport } from "../../lib/lifescale-data";
import { todayInTimeZone } from "../../lib/life-calculations";
import type { Checkin, LifeEntry, LifeProfile, Locale } from "../../lib/types";

const moodLabels: Record<string, string> = { calm: "平静", happy: "开心", grateful: "感恩", tired: "疲惫", sad: "难过", anxious: "焦虑", hopeful: "充满希望" };
const categoryLabels: Record<string, string> = { daily: "日常", family: "家人", work: "工作", growth: "成长", health: "健康", travel: "旅行", reflection: "感悟", other: "其他" };

export function ReportView({ profile, entries, checkins, locale }: { profile: LifeProfile; entries: LifeEntry[]; checkins: Checkin[]; locale: Locale }) {
  const en = locale === "en";
  const moodNames = en ? { calm: "Calm", happy: "Happy", grateful: "Grateful", tired: "Tired", sad: "Sad", anxious: "Anxious", hopeful: "Hopeful" } : moodLabels;
  const categoryNames = en ? { daily: "Daily life", family: "Family", work: "Work", growth: "Growth", health: "Health", travel: "Travel", reflection: "Reflection", other: "Other" } : categoryLabels;
  const today = todayInTimeZone(profile.timezone);
  const report = useMemo(() => buildSevenDayReport(entries, checkins, today), [checkins, entries, today]);
  const [representative, setRepresentative] = useState(report.entries[0]?.id || "");
  const [status, setStatus] = useState("");
  const moodTotal = Math.max(1, Object.values(report.moods).reduce((sum, value) => sum + value, 0));

  async function persistReport() {
    setStatus(en ? "Saving…" : "正在保存…");
    try {
      await saveSevenDayReport({ userId: profile.id, start: report.start, end: report.end, representativeEntryId: representative || null, data: { entryCount: report.entryCount, recordedDays: report.recordedDays, currentStreak: report.currentStreak, moods: report.moods, categories: report.categories, topCategory: report.topCategory } });
      setStatus(en ? "Your 7-day report is saved to the cloud." : "7天报告已保存到云端。");
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : (en ? "Could not save the report." : "保存失败。")); }
  }

  function downloadCard() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#f2eee4"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#143d2f"; context.fillRect(730, 0, 470, 630);
    context.fillStyle = "#d79b2f"; context.font = "700 22px system-ui"; context.fillText(en ? "LIFESCALE · 7 DAY REVIEW" : "LIFESCALE · 7天回望", 72, 92);
    context.fillStyle = "#143d2f"; context.font = "500 58px serif"; context.fillText(en ? "This week, I recorded" : "这一周，我留下了", 72, 190);
    context.font = "700 118px serif"; context.fillText(String(report.recordedDays), 72, 340);
    context.font = "500 36px system-ui"; context.fillText(en ? "days worth remembering" : "个有记录的日子", 230, 330);
    context.font = "400 25px system-ui"; context.fillStyle = "#64766e"; context.fillText(en ? `${report.currentStreak}-day streak · ${report.entryCount} entries` : `连续记录 ${report.currentStreak} 天 · 共 ${report.entryCount} 条记录`, 72, 415);
    context.fillStyle = "#ffffff"; context.font = "500 34px serif"; context.fillText(en ? "See the life ahead." : "看见余生，", 800, 230); context.fillText(en ? "Make today count." : "认真今天。", 800, 280);
    context.fillStyle = "#d79b2f"; context.font = "700 18px system-ui"; context.fillText("app.lifescale.space", 800, 520);
    const link = document.createElement("a"); link.download = `lifescale-7-day-${today}.png`; link.href = canvas.toDataURL("image/png"); link.click();
  }

  return (
    <section className="report-page">
      <header className="section-heading"><div><p className="kicker">7 DAY REPORT</p><h1>{en ? "Where did your time go this week?" : "这一周，时间去了哪里？"}</h1></div><p>{report.start} 至 {report.end}</p></header>
      <div className="report-hero"><div><span>{en ? "Recorded days" : "有记录的日子"}</span><strong>{report.recordedDays}<small>/ 7</small></strong><p>{en ? "Today did not simply pass. You kept it." : "今天没有只是过去，而是被你留下了。"}</p></div><div><span>{en ? "Current streak" : "当前连续"}</span><strong>{report.currentStreak}<small>{en ? " days" : "天"}</small></strong></div><div><span>{en ? "Total entries" : "记录总数"}</span><strong>{report.entryCount}<small>{en ? "" : "条"}</small></strong></div></div>
      <div className="report-grid">
        <section className="report-block"><h2>{en ? "Your mood this week" : "这一周的心情"}</h2>{Object.keys(report.moods).length ? <div className="mood-bars">{Object.entries(report.moods).sort((a, b) => b[1] - a[1]).map(([mood, count]) => <div key={mood}><span>{moodNames[mood as keyof typeof moodNames]}</span><i><b style={{ width: `${(count / moodTotal) * 100}%` }} /></i><small>{count}</small></div>)}</div> : <p className="empty-copy">{en ? "Your mood distribution will appear after your first entry." : "有了第一条记录后，这里会出现你的心情分布。"}</p>}</section>
        <section className="report-block"><h2>{en ? "What shaped your time" : "时间的关键词"}</h2>{report.topCategory ? <><strong className="top-category">{categoryNames[report.topCategory as keyof typeof categoryNames]}</strong><p>{en ? "This was the most common theme in your entries." : "这是你本周记录中出现最多的主题。"}</p></> : <p className="empty-copy">{en ? "There are not enough entries yet." : "暂时还没有足够的记录。"}</p>}<label>{en ? "Choose a representative entry" : "选择一条代表记录"}<select value={representative} onChange={(event) => setRepresentative(event.target.value)}><option value="">{en ? "None for now" : "暂不选择"}</option>{report.entries.map((entry) => <option value={entry.id} key={entry.id}>{entry.entry_date.slice(0, 10)} · {entry.content.slice(0, 24) || (en ? "Today +1" : "今天 +1")}</option>)}</select></label></section>
      </div>
      <div className="report-actions"><button className="primary-button" onClick={persistReport}>{en ? "Save report" : "保存本期报告"}</button><button className="outline-button" onClick={downloadCard}>{en ? "Download share card" : "下载分享卡"}</button><span>{status}</span></div>
      <p className="report-privacy">{en ? "Share cards never include your email, full birth date, exact target date, or journal text." : "分享卡不会包含邮箱、完整出生日期、精确目标日期或任何日记正文。"}</p>
    </section>
  );
}
