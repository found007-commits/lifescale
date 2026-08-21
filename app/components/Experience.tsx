"use client";

import { useMemo, useState } from "react";
import { useLifeScaleSession } from "../../lib/auth-client";
import { ageOnDate, calculateLifeMetrics, targetDateFromAge, todayInTimeZone } from "../../lib/life-calculations";
import type { Locale } from "../../lib/types";
import { useTheme } from "../../lib/use-theme";
import { AuthPanel } from "./AuthPanel";
import { Brand } from "./Brand";
import { Dashboard } from "./Dashboard";

const pageCopy = {
  zh: {
    nav: ["生命刻度", "今天 +1", "7天报告", "隐私"],
    signIn: "注册 / 登录", eyebrow: "人生时间账户", hero: "看见余生，认真今天。", emotion: "把余生，活成自己的作品。",
    intro: "看见仍可书写的时间，留下今天真实发生的事，也把重要的人与心愿好好珍藏。",
    birth: "出生日期", age: "希望活到的年龄", preview: "预览我的人生刻度", save: "保存我的人生刻度",
    remaining: "仍可认真生活的日子", disclaimer: "这不是死亡预测，而是你为自己设定的人生时间目标。",
    walked: "已经走过", years: "年", days: "天", private: "默认私密", sync: "跨设备同步", report: "7天回望",
    pillarsTitle: ["不是倒数生命，", "而是把今天留下。"], pillars: ["每天用一段话或一张照片记录今天。", "从7天报告里看见情绪、关系和时间去向。", "重要数据由你确认，私密记录只属于你。"],
    product: "进入品牌官网", theme: "切换明暗模式",
  },
  en: {
    nav: ["Life Scale", "Today +1", "7-Day Report", "Privacy"],
    signIn: "Sign up / Sign in", eyebrow: "YOUR LIFE TIME ACCOUNT", hero: "See your time. Live it well.", emotion: "Leave what matters.",
    intro: "See the time still yours to shape, keep what happened today, and preserve the people and wishes that matter.",
    birth: "Date of birth", age: "Age you hope to reach", preview: "Preview my LifeScale", save: "Save my LifeScale",
    remaining: "days still yours to shape", disclaimer: "This is not a prediction of death. It is a personal life target you set for yourself.",
    walked: "Days lived", years: "years", days: "days", private: "Private by default", sync: "Cross-device sync", report: "7-day reflection",
    pillarsTitle: ["Not counting down a life.", "Keeping today."], pillars: ["Keep today with a sentence or a photo.", "See moods, relationships and attention in a 7-day report.", "You confirm your core data. Your private records remain yours."],
    product: "Brand website", theme: "Toggle color theme",
  },
} as const;

export function Experience({ initialLocale }: { initialLocale: Locale; country: string }) {
  const { session, isPending } = useLifeScaleSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [authOpen, setAuthOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [targetAge, setTargetAge] = useState(90);
  const [previewed, setPreviewed] = useState(false);
  const { theme, setTheme } = useTheme();
  const t = pageCopy[locale];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayInTimeZone(timezone);
  const currentAge = birthDate ? ageOnDate(birthDate, today) : 0;
  const minimumAge = Math.max(30, currentAge + 1);

  const metrics = useMemo(() => {
    if (!birthDate || targetAge < minimumAge || targetAge > 150) return null;
    try { return calculateLifeMetrics({ birthDate, targetAge, timeZone: timezone }); } catch { return null; }
  }, [birthDate, minimumAge, targetAge, timezone]);

  if (isPending) return <main className="app-loading full">LifeScale</main>;
  if (session?.user) return <Dashboard session={session} />;

  function openAuthWithDraft() {
    if (metrics) {
      window.localStorage.setItem("lifescale:preview-draft", JSON.stringify({ birthDate, targetAge, targetDate: targetDateFromAge(birthDate, targetAge), locale, timezone }));
    }
    setAuthOpen(true);
  }

  return (
    <main className="marketing-shell">
      <header className="site-header">
        <Brand />
        <nav aria-label={locale === "zh" ? "主要导航" : "Primary navigation"}>
          <a href="#scale">{t.nav[0]}</a><a href="#today">{t.nav[1]}</a><a href="#report">{t.nav[2]}</a><a href="/privacy">{t.nav[3]}</a>
        </nav>
        <div className="header-actions">
          <button className="theme-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={t.theme}>{theme === "light" ? "◐" : "☼"}</button>
          <label className="language-select"><span className="sr-only">Language</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="zh">中文</option><option value="en">EN</option></select></label>
          <button className="outline-button" onClick={() => setAuthOpen(true)}>{t.signIn}</button>
        </div>
      </header>

      <section className="preview-hero" id="scale">
        <div className="preview-hero-copy">
          <p className="kicker">{t.eyebrow}</p>
          <h1>{t.hero}</h1>
          <p className="hero-emotion">{t.emotion}</p>
          <p className="hero-intro">{t.intro}</p>
          <div className="trust-row"><span>● {t.private}</span><span>↻ {t.sync}</span><span>◷ {t.report}</span></div>
        </div>

        <div className="free-preview-card">
          <div className="preview-card-heading"><span>FREE PREVIEW</span><strong>{t.preview}</strong></div>
          <div className="preview-inputs">
            <label>{t.birth}<input type="date" max={today} value={birthDate} onChange={(event) => { setBirthDate(event.target.value); setPreviewed(false); }} /></label>
            <label>{t.age}<div className="age-field"><input type="number" min={minimumAge} max={150} inputMode="numeric" value={targetAge} onChange={(event) => { setTargetAge(Number(event.target.value)); setPreviewed(false); }} /><span>{locale === "zh" ? "岁" : "years"}</span></div></label>
          </div>
          {!previewed || !metrics ? (
            <button className="primary-button preview-submit" disabled={!metrics} onClick={() => setPreviewed(true)}>{t.preview}</button>
          ) : (
            <div className="preview-result" aria-live="polite">
              <p>{t.remaining}</p><strong>{metrics.remainingDays.toLocaleString()}</strong><span>{t.days}</span>
              <div><small>{t.walked}</small><b>{metrics.livedDays.toLocaleString()} {t.days}</b></div>
              <button className="primary-button" onClick={openAuthWithDraft}>{t.save}</button>
            </div>
          )}
          <p className="preview-disclaimer">{t.disclaimer}</p>
        </div>
      </section>

      <section className="time-ribbon" id="today"><span>365</span><p>{locale === "zh" ? "每一年，不只是经过。" : "A year should be more than time passing."}</p><b>+1 TODAY</b></section>

      <section className="product-principles" id="report">
        <div><p className="kicker">LIFESCALE</p><h2>{t.pillarsTitle.map((line) => <span key={line}>{line}</span>)}</h2></div>
        <ol>{t.pillars.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ol>
      </section>

      <section className="preview-final-cta"><h2>{t.emotion}</h2><button className="light-button" onClick={() => setAuthOpen(true)}>{t.save} →</button><p>{t.disclaimer}</p></section>

      <footer className="site-footer"><Brand compact /><p><a href="https://lifescale.space">{t.product}</a></p><nav><a href="/privacy">{t.nav[3]}</a><a href="/terms">Terms</a><a href="/third-parties">Third parties</a><a href="/account-deletion">Delete account</a></nav><small>© {new Date().getFullYear()} LifeScale</small></footer>
      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} locale={locale} />
    </main>
  );
}
