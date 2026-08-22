"use client";

import { useMemo, useState } from "react";
import type { Locale } from "../../lib/types";

type DatePart = "year" | "month" | "day";
type DateFieldProps = {
  id: string;
  label: string;
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  hint?: string;
};

export function dateFieldOrder(locale: string): DatePart[] {
  return locale.toLowerCase().startsWith("en")
    ? ["day", "month", "year"]
    : ["year", "month", "day"];
}

export function formatLocalizedDate(value: string, locale: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return locale.toLowerCase().startsWith("en")
    ? `${day}/${month}/${year}`
    : `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function splitDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: "", month: "", day: "" };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: string | number) {
  return String(value).padStart(2, "0");
}

export function LocalizedDateField(props: DateFieldProps) {
  return <LocalizedDateInput key={`${props.id}:${props.value}`} {...props} />;
}

function LocalizedDateInput({
  id,
  label,
  locale,
  value,
  onChange,
  min = "1900-01-01",
  max = `${new Date().getFullYear() + 150}-12-31`,
  hint,
}: DateFieldProps) {
  const initial = splitDate(value);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const en = locale === "en";
  const minParts = splitDate(min);
  const maxParts = splitDate(max);
  const minYear = Number(minParts.year) || 1900;
  const maxYear = Number(maxParts.year) || new Date().getFullYear() + 150;

  const years = useMemo(() => Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, index) => maxYear - index), [maxYear, minYear]);
  const months = useMemo(() => {
    const selectedYear = Number(year);
    const start = selectedYear === minYear ? Number(minParts.month) : 1;
    const end = selectedYear === maxYear ? Number(maxParts.month) : 12;
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [maxParts.month, maxYear, minParts.month, minYear, year]);
  const days = useMemo(() => {
    if (!year || !month) return Array.from({ length: 31 }, (_, index) => index + 1);
    const selectedYear = Number(year);
    const selectedMonth = Number(month);
    const start = selectedYear === minYear && selectedMonth === Number(minParts.month) ? Number(minParts.day) : 1;
    let end = daysInMonth(selectedYear, selectedMonth);
    if (selectedYear === maxYear && selectedMonth === Number(maxParts.month)) end = Math.min(end, Number(maxParts.day));
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [maxParts.day, maxParts.month, maxYear, minParts.day, minParts.month, minYear, month, year]);

  function commit(next: { year: string; month: string; day: string }) {
    setYear(next.year); setMonth(next.month); setDay(next.day);
    if (!next.year || !next.month || !next.day) { onChange(""); return; }
    const candidate = `${next.year}-${pad(next.month)}-${pad(next.day)}`;
    onChange(candidate >= min && candidate <= max ? candidate : "");
  }

  function change(part: DatePart, nextValue: string) {
    const next = { year, month, day, [part]: nextValue };
    if (part !== "day" && next.year && next.month && next.day) {
      const availableDays = daysInMonth(Number(next.year), Number(next.month));
      if (Number(next.day) > availableDays) next.day = String(availableDays);
    }
    commit(next);
  }

  const labels: Record<DatePart, string> = en
    ? { year: "Year", month: "Month", day: "Day" }
    : { year: "年", month: "月", day: "日" };

  return (
    <fieldset className="localized-date-field">
      <legend>{label}</legend>
      <div className="date-select-row">
        {dateFieldOrder(locale).map((part) => {
          const options = part === "year" ? years : part === "month" ? months : days;
          const selected = part === "year" ? year : part === "month" ? month : day;
          return (
            <label className={`date-select-segment ${part}`} key={part}>
              <span>{labels[part]}</span>
              <select id={`${id}-${part}`} value={selected} onChange={(event) => change(part, event.target.value)} aria-label={`${label} ${labels[part]}`}>
                <option value="">--</option>
                {options.map((option) => <option value={String(option)} key={option}>{option}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      {value ? <output className="date-selection-preview">{formatLocalizedDate(value, locale)}</output> : null}
      {hint ? <small>{hint}</small> : null}
    </fieldset>
  );
}
