"use client";

import type { Locale } from "../../lib/types";

const PRESET_AGES = [70, 80, 90, 100];

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
  const presets = PRESET_AGES.filter((age) => age >= minimumAge);

  return (
    <fieldset className="target-age-field">
      <legend>{en ? "Age you hope to reach" : "希望活到的年龄"}</legend>
      {presets.length ? (
        <div className="age-presets" role="group" aria-label={en ? "Common target ages" : "常用目标年龄"}>
          {presets.map((age) => (
            <button
              type="button"
              className={value === String(age) ? "selected" : ""}
              onClick={() => onChange(String(age))}
              key={age}
            >
              {age}<span>{en ? " yrs" : " 岁"}</span>
            </button>
          ))}
        </div>
      ) : null}
      <label className="custom-age-label">
        <span>{en ? "Or enter your own age" : "或自行填写"}</span>
        <div className="age-field">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={3}
            value={value}
            placeholder={en ? `${minimumAge}–150` : `${minimumAge}–150 岁`}
            aria-describedby="target-age-guidance"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => onChange(normalizeTargetAge(event.target.value))}
          />
          <span>{en ? "years" : "岁"}</span>
        </div>
      </label>
      <small id="target-age-guidance" className="target-age-guidance">
        {en
          ? `Choose a preset or enter ${minimumAge}–150. Your final choice can only be confirmed once.`
          : `可直接选择，也可填写 ${minimumAge}–150 岁。正式保存后只能确认一次，请慎重选择。`}
      </small>
    </fieldset>
  );
}
