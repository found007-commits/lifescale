"use client";

import type { Locale } from "../../lib/types";

// A language is offered under its own name, which is why these three strings are the same
// on every page and in every locale: they are proper nouns rather than copy. Holding them
// here is what lets the guide shell stay a component with no words of its own.
export const LOCALE_OPTIONS = [
  { value: "zh", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
] as const satisfies readonly { value: Locale; label: string }[];

// The same control the landing page puts in its header, so a visitor reading a guide page
// can switch language where they are instead of going back to the home page first. Only the
// accessible name is copy, and it is passed in rather than written here.
export function LocaleSelect({ locale, label, onChange }: {
  locale: Locale;
  label: string;
  onChange: (next: Locale) => void;
}) {
  return (
    <label className="language-select">
      <span className="sr-only">{label}</span>
      <select value={locale} onChange={(event) => onChange(event.target.value as Locale)}>
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
