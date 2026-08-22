import type { Locale } from "./types";

const traditionalChineseRegions = new Set(["HK", "MO", "TW"]);

export function detectLocale(country: string | null, acceptLanguage: string | null): Locale {
  const countryCode = country?.trim().toUpperCase();
  if (countryCode === "CN") return "zh";
  if (countryCode && traditionalChineseRegions.has(countryCode)) return "zh-TW";
  if (!countryCode) {
    const browserLanguage = (acceptLanguage || "").toLowerCase();
    if (/^zh-(tw|hk|mo|hant)/.test(browserLanguage)) return "zh-TW";
    if (browserLanguage.startsWith("zh")) return "zh";
  }
  return "en";
}

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "zh-TW" || value === "en";
}
