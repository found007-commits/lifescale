import type { GenderOption, Locale } from "./types";

export const genderOptions: GenderOption[] = ["male", "female", "l", "g", "b", "t", "q", "private"];

const labels: Record<Locale, Record<GenderOption, string>> = {
  zh: { male: "男", female: "女", l: "L", g: "G", b: "B", t: "T", q: "Q", private: "保密" },
  "zh-TW": { male: "男", female: "女", l: "L", g: "G", b: "B", t: "T", q: "Q", private: "保密" },
  en: { male: "Man", female: "Woman", l: "L", g: "G", b: "B", t: "T", q: "Q", private: "Private" },
};

export function genderLabel(value: GenderOption, locale: Locale) {
  return labels[locale][value];
}
