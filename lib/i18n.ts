import type { Locale } from "./types";

const chineseRegions = new Set(["CN", "HK", "MO", "TW", "SG"]);

export function detectLocale(country: string | null, acceptLanguage: string | null): Locale {
  if (country && chineseRegions.has(country.toUpperCase())) return "zh";
  if ((acceptLanguage || "").toLowerCase().startsWith("zh")) return "zh";
  return "en";
}
