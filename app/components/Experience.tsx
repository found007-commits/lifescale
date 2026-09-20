"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLifeScaleSession } from "../../lib/auth-client";
import { isLocale } from "../../lib/i18n";
import { ageOnDate, calculateChapterMetrics, calculateLifeMetrics, targetDateFromAge, todayInTimeZone } from "../../lib/life-calculations";
import type { Locale } from "../../lib/types";
import { useTheme } from "../../lib/use-theme";
import { useTraditionalChinese } from "../../lib/use-traditional-chinese";
import { AuthPanel } from "./AuthPanel";
import { Brand } from "./Brand";
import { Dashboard } from "./Dashboard";
import { LocalizedDateField } from "./LocalizedDateField";
import { TargetAgeField } from "./TargetAgeField";

const pageCopy = {
  zh: {
    nav: ["生命刻度", "今天 +1", "7天报告", "隐私"],
    signIn: "注册 / 登录", eyebrow: "人生时间账户", hero: "看见余生，认真今天。", emotion: "把每个今天，好好留下。",
    intro: "看见仍可书写的时间，留下今天真实发生的事，也把重要的人与心愿好好珍藏。",
    birth: "出生日期", age: "希望活到的年龄", preview: "预览我的余生刻度", save: "保存我的余生刻度",
    remaining: "仍可认真生活的日子", disclaimer: "这不是死亡预测，而是你为自己设定的人生时间目标。",
    walked: "已经走过", years: "年", days: "天", private: "默认私密", sync: "跨设备同步", report: "7天回望",
    pillarsTitle: ["不是倒数生命，", "而是把今天留下。"], pillars: ["每天用一段话或一张照片记录今天。", "从7天报告里看见情绪、关系和时间去向。", "重要数据由你确认，私密记录只属于你。"],
    product: "进入品牌官网", theme: "切换明暗模式",
    navChapters: "1000 天",
    chaptersEyebrow: "CHAPTERS & SANCTUARY",
    chaptersTitle: ["把日子分成章，", "也给心愿留个位置。"],
    chaptersLead: "每 1000 天算一章。走到你自己设定的目标那天之前，这是目标轨；之后你走进额外旅程，每一天都是多出来的时间。想交代的话，可以放进默认私密的精神圣所。",
    chapterTrackName: "双轨 1000 天",
    chapterTrackPoints: ["目标轨：每 1000 天一章，第 1 章从第 1 天开始。", "额外旅程：超过目标之后，每一天都记为多出来的日子。", "章节只描述时间，不做寿命预测。"],
    chapterSanctuaryName: "精神圣所",
    chapterSanctuaryPoints: ["默认私密：只有你亲手开启公开，其他登录用户才读得到。", "墓志铭与三条信条由你自己写、自己改。", "好友致意的署名与计数由服务端决定，无法冒名。", "随时可以关闭公开，或删掉别人留下的致意。"],
    chapterLiveLabel: "我此刻的这一章",
    chapterLiveTitle: (chapter: number, day: number) => `第 ${chapter} 章 · 第 ${day} / 1000 天`,
    chapterLiveRemaining: (days: number) => `距本章结束还有 ${days} 天`,
    chapterLiveBonus: (days: number) => `额外旅程第 ${days} 天`,
    chapterTrackLink: "1000 天怎么分章 →",
    chapterSanctuaryLink: "精神圣所怎么保护你 →",
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
    navChapters: "1,000 days",
    chaptersEyebrow: "CHAPTERS & SANCTUARY",
    chaptersTitle: ["Divide the days into chapters.", "Give the wishes somewhere to live."],
    chaptersLead: "Every 1,000 days is one chapter. Until the target you set for yourself, you are on the main track; after it, you are on the bonus journey, where every single day is extra time. What you want to leave behind can go into a sanctuary that is private by default.",
    chapterTrackName: "Two tracks, 1,000 days a chapter",
    chapterTrackPoints: ["Main track: 1,000 days to a chapter, and chapter 1 starts on day 1.", "Bonus journey: past your target, every day is counted as extra.", "Chapters describe time only. They never predict a lifespan."],
    chapterSanctuaryName: "The sanctuary",
    chapterSanctuaryPoints: ["Private by default: other signed-in users can read it only after you open it yourself.", "The epitaph and three creeds are written and revised by you alone.", "Signatures and tribute counts are decided server side, so nobody can post as somebody else.", "You can close it again, or remove a tribute, at any time."],
    chapterLiveLabel: "The chapter you are in",
    chapterLiveTitle: (chapter: number, day: number) => `Chapter ${chapter} · Day ${day} of 1,000`,
    chapterLiveRemaining: (days: number) => `${days} days left in this chapter`,
    chapterLiveBonus: (days: number) => `Bonus day ${days}`,
    chapterTrackLink: "How the 1,000-day chapters work →",
    chapterSanctuaryLink: "How the sanctuary protects you →",
  },
} as const;

export function Experience({ initialLocale }: { initialLocale: Locale; country: string }) {
  const { session, isPending } = useLifeScaleSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const surfaceRef = useRef<HTMLElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [targetAge, setTargetAge] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const { theme, setTheme } = useTheme();
  const t = pageCopy[locale === "zh-TW" ? "zh" : locale];
  useTraditionalChinese(surfaceRef, locale);

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("lifescale:locale");
    if (!isLocale(savedLocale)) return;
    const frame = window.requestAnimationFrame(() => setLocale(savedLocale));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayInTimeZone(timezone);
  const currentAge = birthDate ? ageOnDate(birthDate, today) : 0;
  const minimumAge = Math.max(30, currentAge + 1);
  const numericTargetAge = Number.parseInt(targetAge, 10);

  const metrics = useMemo(() => {
    if (!birthDate || !Number.isInteger(numericTargetAge) || numericTargetAge < minimumAge || numericTargetAge > 150) return null;
    try { return calculateLifeMetrics({ birthDate, targetAge: numericTargetAge, timeZone: timezone }); } catch { return null; }
  }, [birthDate, minimumAge, numericTargetAge, timezone]);

  // The chapter line is derived from the same metrics the free preview uses, so the two can
  // never disagree. It stays hidden until the visitor has actually entered both values:
  // no chapter number is invented for a visitor who has given us nothing.
  const chapters = useMemo(() => (metrics ? calculateChapterMetrics(metrics.livedDays, metrics.totalDays) : null), [metrics]);

  if (isPending) return <main className="app-loading full">LifeScale</main>;
  if (session?.user) return <Dashboard session={session} initialLocale={locale} />;

  function changeLocale(next: Locale) {
    setLocale(next);
    window.localStorage.setItem("lifescale:locale", next);
  }

  function openAuthWithDraft() {
    if (metrics) {
      window.localStorage.setItem("lifescale:preview-draft", JSON.stringify({ birthDate, targetAge: numericTargetAge, targetDate: targetDateFromAge(birthDate, numericTargetAge), locale, timezone }));
    }
    setAuthOpen(true);
  }

  return (
    <main className="marketing-shell" key={locale} ref={surfaceRef} lang={locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : "en"}>
      <header className="site-header">
        <Brand />
        <nav aria-label={locale === "en" ? "Primary navigation" : "主要导航"}>
          <a href="#scale">{t.nav[0]}</a><a href="#today">{t.nav[1]}</a><a href="#chapters">{t.navChapters}</a><a href="#report">{t.nav[2]}</a><a href="/privacy">{t.nav[3]}</a>
        </nav>
        <div className="header-actions">
          <button className="theme-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={t.theme}>{theme === "light" ? "◐" : "☼"}</button>
          <label className="language-select"><span className="sr-only">Language</span><select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="zh">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label>
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
            <LocalizedDateField id="preview-birth-date" label={t.birth} locale={locale} max={today} value={birthDate} onChange={(value) => { setBirthDate(value); setPreviewed(false); }} hint={locale === "en" ? "Day / month / year" : "年 / 月 / 日"} />
            <TargetAgeField locale={locale} minimumAge={minimumAge} value={targetAge} onChange={(value) => { setTargetAge(value); setPreviewed(false); }} />
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

      <section className="time-ribbon" id="today"><span>365</span><p>{locale === "en" ? "A year should be more than time passing." : "每一年，不只是经过。"}</p><b>+1 TODAY</b></section>

      <section className="chapter-section" id="chapters">
        <div>
          <p className="kicker">{t.chaptersEyebrow}</p>
          <h2>{t.chaptersTitle.map((line) => <span key={line}>{line}</span>)}</h2>
          <p className="chapter-lead">{t.chaptersLead}</p>
        </div>
        <div className="chapter-cards">
          <article className="chapter-card">
            <span className="chapter-eyebrow">01</span>
            <h3>{t.chapterTrackName}</h3>
            <ul>{t.chapterTrackPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            {chapters && (
              <div className="chapter-live" aria-live="polite">
                <span className="chapter-eyebrow">{t.chapterLiveLabel}</span>
                <strong>{t.chapterLiveTitle(chapters.currentChapter, chapters.chapterDayIndex)}</strong>
                <small>{chapters.isBonusLife ? t.chapterLiveBonus(chapters.bonusDayCount) : t.chapterLiveRemaining(chapters.chapterDaysRemaining)}</small>
              </div>
            )}
            <div className="chapter-links"><a className="outline-button" href="/chapters">{t.chapterTrackLink}</a></div>
          </article>
          <article className="chapter-card">
            <span className="chapter-eyebrow">02</span>
            <h3>{t.chapterSanctuaryName}</h3>
            <ul>{t.chapterSanctuaryPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            <div className="chapter-links"><a className="outline-button" href="/sanctuary">{t.chapterSanctuaryLink}</a></div>
          </article>
        </div>
      </section>

      <section className="product-principles" id="report">
        <div><p className="kicker">LIFESCALE</p><h2>{t.pillarsTitle.map((line) => <span key={line}>{line}</span>)}</h2></div>
        <ol>{t.pillars.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ol>
      </section>

      <section className="preview-final-cta"><h2>{t.emotion}</h2><button className="light-button" onClick={() => setAuthOpen(true)}>{t.save} →</button><p>{t.disclaimer}</p></section>

      <footer className="site-footer"><Brand compact /><p><a href="https://lifescale.space">{t.product}</a></p><nav><a href="/chapters">{t.navChapters}</a><a href="/sanctuary">{t.chapterSanctuaryName}</a><a href="/privacy">{t.nav[3]}</a><a href="/terms">Terms</a><a href="/third-parties">Third parties</a><a href="/account-deletion">Delete account</a></nav><small>© {new Date().getFullYear()} LifeScale</small></footer>
      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} locale={locale} />
    </main>
  );
}
