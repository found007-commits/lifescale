"use client";

import type { Locale } from "../../lib/types";
import { RULE_ZH, RULE_EN } from "../../miniprogram/utils/target-policy";

export function normalizeTargetAge(raw: string) {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.slice(0, 3);
}

export function TargetAgeField({
  locale,
  minimumAge,
  value,
  onChange,
}: {
  locale: Locale;
  minimumAge: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const en = locale === "en";

  return (
    <fieldset className="target-age-field">
      <legend>{en ? "The age you choose for your life target" : "你为自己设定的目标年龄"}</legend>
      <label className="custom-age-label">
        <span>{en ? "Enter your own number" : "请自行填写，不提供推荐数字"}</span>
        <div className="age-field">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={3}
            value={value}
            placeholder={en ? `${minimumAge}-150` : `${minimumAge}-150 岁`}
            aria-describedby="target-age-guidance"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => onChange(normalizeTargetAge(event.target.value))}
          />
          <span>{en ? "years" : "岁"}</span>
        </div>
      </label>
      <small id="target-age-guidance" className="target-age-guidance">
        {en
          ? `Enter an integer from ${minimumAge} to 150. ${RULE_EN}`
          : `请输入 ${minimumAge}-150 岁之间的整数。${RULE_ZH}`}
      </small>
    </fieldset>
  );
}
