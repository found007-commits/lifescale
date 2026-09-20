"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isLocale } from "../../lib/i18n";
import type { Locale } from "../../lib/types";
import { useTheme } from "../../lib/use-theme";
import { useTraditionalChinese } from "../../lib/use-traditional-chinese";
import { Brand } from "./Brand";
import { LocaleSelect } from "./LocaleSelect";

export type GuideSection = { heading: string; body: string; bullets?: readonly string[] };

export type GuideCopy = {
  eyebrow: string;
  title: string;
  updated: string;
  lead: string;
  figure?: { value: string; caption: string };
  facts: readonly { heading: string; body: string }[];
  sections: readonly GuideSection[];
  note: string;
  back: string;
  privacy: string;
  language: string;
  theme: string;
  footer: readonly { label: string; href: string }[];
};

// A guide page is a static document, but it has to follow the visitor's language the same
// way the landing page does: the server picks a starting locale from the request, the
// choice the visitor already made on the home page wins once the page is hydrated, and the
// header offers the same controls the landing page does so the visitor does not have to go
// back there to read this document in another language or on a dark background. Traditional
// Chinese is produced by the shared OpenCC pass, so only zh and en copy exist.
export function GuidePage({ initialLocale, copy }: { initialLocale: Locale; copy: { zh: GuideCopy; en: GuideCopy } }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const surfaceRef = useRef<HTMLElement>(null);
  const { theme, setTheme } = useTheme();
  useTraditionalChinese(surfaceRef, locale);
  const t = copy[locale === "zh-TW" ? "zh" : locale];

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("lifescale:locale");
    if (!isLocale(savedLocale)) return;
    const frame = window.requestAnimationFrame(() => setLocale(savedLocale));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // The same key the landing page writes, so the two agree on which language the visitor
  // asked for: switching here is remembered there, and the other way round.
  function changeLocale(next: Locale) {
    setLocale(next);
    window.localStorage.setItem("lifescale:locale", next);
  }

  return (
    <main className="guide-shell" key={locale} ref={surfaceRef} lang={locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : "en"}>
      <header className="legal-header guide-header">
        <Brand />
        <div className="header-actions">
          <button className="theme-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={t.theme}>{theme === "light" ? "◐" : "☼"}</button>
          <LocaleSelect locale={locale} label={t.language} onChange={changeLocale} />
          <Link href="/">{t.back}</Link>
        </div>
      </header>
      <article className="guide-content">
        <p className="kicker">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="guide-updated">{t.updated}</p>
        <p className="guide-lead">{t.lead}</p>
        {t.figure && (
          <div className="guide-figure">
            <strong>{t.figure.value}</strong>
            <span>{t.figure.caption}</span>
          </div>
        )}
        <ul className="guide-facts">
          {t.facts.map((fact) => (
            <li key={fact.heading}><b>{fact.heading}</b><span>{fact.body}</span></li>
          ))}
        </ul>
        {t.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
            {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
          </section>
        ))}
        <p className="guide-note">{t.note}</p>
        <div className="guide-actions">
          <Link className="primary-button" href="/">{t.back}</Link>
          <Link className="outline-button" href="/privacy">{t.privacy}</Link>
        </div>
      </article>
      <footer className="guide-footer">
        {t.footer.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
      </footer>
    </main>
  );
}
