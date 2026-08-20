"use client";

import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { copy, type Locale } from "../../lib/i18n";
import { AuthPanel } from "./AuthPanel";
import { Brand } from "./Brand";
import { Dashboard } from "./Dashboard";

export function Experience({ initialLocale }: { initialLocale: Locale; country: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [authOpen, setAuthOpen] = useState(false);
  const t = copy[locale];

  if (isPending) return <main className="app-loading full">Opening LifeScale…</main>;
  if (session) return <Dashboard session={session} />;

  return (
    <main className="marketing-shell">
      <header className="site-header">
        <Brand />
        <nav aria-label="Primary navigation"><a href="#how">{t.navHow}</a><a href="/privacy">{t.navPrivacy}</a></nav>
        <div className="header-actions">
          <label className="language-select"><span className="sr-only">Language</span><select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}><option value="en">EN</option><option value="zh">中文</option><option value="es">ES</option><option value="ja">日本語</option></select></label>
          <button className="outline-button" onClick={() => setAuthOpen(true)}>{t.navSignIn}</button>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="kicker">{t.eyebrow}</p>
          <h1>{t.heroA}<br /><em>{t.heroB}</em></h1>
          <p className="hero-intro">{t.intro}</p>
          <div className="hero-actions"><button className="primary-button large" onClick={() => setAuthOpen(true)}>{t.begin}</button><span><i /> {t.private}<small>{t.noAds}</small></span></div>
        </div>
        <div className="hero-visual" aria-label="LifeScale product preview">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="phone">
            <div className="phone-top"><span>9:41</span><b /></div>
            <div className="phone-brand"><span className="mini-mark">◔</span> LifeScale</div>
            <p>MY LIFE SCALE</p>
            <div className="preview-dial"><div><strong>16,429</strong><small>{t.remaining}</small></div></div>
            <button>{t.today}<span>Today +1</span></button>
          </div>
          <div className="floating-note note-one"><span>A MOMENT</span><strong>Keep today’s light</strong><small>only you can see</small></div>
          <div className="floating-note note-two"><span>SOMEONE I LOVE</span><strong>The people who stay</strong></div>
        </div>
      </section>

      <section className="value-section" id="how">
        <div className="value-heading"><p className="kicker">WHY LIFESCALE</p><h2>{t.valueTitle}</h2><p>{t.valueText}</p></div>
        <div className="value-cards">
          <article><span>01</span><h3>{t.v1}</h3><p>{t.v1d}</p></article>
          <article><span>02</span><h3>{t.v2}</h3><p>{t.v2d}</p></article>
          <article><span>03</span><h3>{t.v3}</h3><p>{t.v3d}</p></article>
        </div>
      </section>

      <section className="quote-section"><blockquote>“{t.quote}”</blockquote><button className="light-button" onClick={() => setAuthOpen(true)}>{t.begin} →</button></section>
      <footer className="site-footer"><Brand compact /><p>{t.footer}</p><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/third-parties">Third parties</a><a href="/account-deletion">Delete account</a></nav><small>© {new Date().getFullYear()} LifeScale</small></footer>
      <AuthPanel open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
