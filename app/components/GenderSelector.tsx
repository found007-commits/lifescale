import { genderLabel, genderOptions } from "../../lib/gender-options";
import type { GenderOption, Locale } from "../../lib/types";

export function GenderSelector({ locale, value, onChange }: { locale: Locale; value: GenderOption | ""; onChange: (value: GenderOption) => void }) {
  const en = locale === "en";
  return <fieldset className="gender-selector"><legend>{en ? "Gender" : "性别"}</legend><div className="gender-option-grid">{genderOptions.map((option) => <button type="button" key={option} className={value === option ? "selected" : ""} aria-pressed={value === option} onClick={() => onChange(option)}>{genderLabel(option, locale)}</button>)}</div><p>{en ? "Choose one option. No text entry is needed." : "选择一项即可，无需手写。"}</p></fieldset>;
}
