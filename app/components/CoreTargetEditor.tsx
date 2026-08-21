"use client";

import { useState } from "react";
import { ageOnDate, daysBetween, targetDateFromAge, todayInTimeZone } from "../../lib/life-calculations";
import { updateProfile } from "../../lib/lifescale-data";
import type { LifeProfile } from "../../lib/types";

export function CoreTargetEditor({ profile, onUpdated }: { profile: LifeProfile; onUpdated: (profile: LifeProfile) => void }) {
  const en = profile.locale === "en";
  const [openedAt] = useState(() => Date.now());
  const unlocked = openedAt >= new Date(profile.target_locked_until).getTime();
  const [editing, setEditing] = useState(false);
  const [birthDate, setBirthDate] = useState(profile.birth_date);
  const [targetType, setTargetType] = useState<"age" | "date">(profile.target_age ? "age" : "date");
  const [targetAge, setTargetAge] = useState(profile.target_age || 90);
  const [targetDate, setTargetDate] = useState(profile.target_date);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState("");
  const today = todayInTimeZone(profile.timezone);
  const minimumAge = Math.max(30, ageOnDate(birthDate, today) + 1);
  const resolvedTarget = targetType === "age" && birthDate ? targetDateFromAge(birthDate, targetAge) : targetDate;
  const valid = Boolean(birthDate && daysBetween(today, resolvedTarget) > 0 && daysBetween(targetDateFromAge(birthDate, 30), resolvedTarget) >= 0);

  if (!unlocked || !editing) {
    return <section className="settings-card locked-profile-card"><div className="settings-title-row"><h2>{en ? "Core life scale" : "核心余生刻度"}</h2><span>{unlocked ? (en ? "Ready to reset" : "可重新设定") : (en ? "Locked" : "锁定中")}</span></div><p>{en ? "This is a personal life-time goal, not a death prediction." : "这不是死亡预测，而是你为自己设定的人生时间目标。"}</p><dl><div><dt>{en ? "Birth date" : "出生日期"}</dt><dd>{profile.birth_date}</dd></div><div><dt>{en ? "Target date" : "目标日期"}</dt><dd>{profile.target_date}</dd></div><div><dt>{en ? "Target method" : "目标方式"}</dt><dd>{profile.target_age ? `${profile.target_age}${en ? " years" : " 岁"}` : (en ? "Exact date" : "具体日期")}</dd></div><div><dt>{en ? "Locked until" : "锁定至"}</dt><dd>{new Date(profile.target_locked_until).toLocaleDateString(en ? "en-US" : "zh-CN")}</dd></div></dl>{unlocked ? <button className="outline-button settings-wide-button" onClick={() => setEditing(true)}>{en ? "Reset and lock for another year" : "重新设定并再次锁定一年"}</button> : <small>{en ? "The server rejects all core-target changes while the lock is active." : "锁定期内，服务端会拒绝任何核心目标修改。"}</small>}</section>;
  }

  async function save() {
    if (!confirmed || !valid) return;
    setStatus(en ? "Saving…" : "正在保存…");
    try {
      const updated = await updateProfile(profile.id, { birth_date: birthDate, target_age: targetType === "age" ? targetAge : null, target_date: resolvedTarget });
      onUpdated(updated); setEditing(false); setStatus("");
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : (en ? "Could not save the new scale." : "保存失败。")); }
  }

  return <section className="settings-card"><h2>{en ? "Reset your life scale" : "重新设定余生刻度"}</h2><p>{en ? "Saving locks it again for one year. Check every detail." : "保存后会再次锁定一年，请认真核对。"}</p><label>{en ? "Birth date" : "出生日期"}<input type="date" max={today} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label><fieldset className="target-type"><legend>{en ? "Target method" : "目标方式"}</legend><button type="button" className={targetType === "age" ? "selected" : ""} onClick={() => setTargetType("age")}>{en ? "Age" : "年龄"}</button><button type="button" className={targetType === "date" ? "selected" : ""} onClick={() => setTargetType("date")}>{en ? "Exact date" : "具体日期"}</button></fieldset>{targetType === "age" ? <label>{en ? "Target age" : "目标年龄"}<input type="number" min={minimumAge} max={150} value={targetAge} onChange={(event) => setTargetAge(Number(event.target.value))} /></label> : <label>{en ? "Target date" : "目标日期"}<input type="date" min={birthDate ? targetDateFromAge(birthDate, 30) : today} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>}<label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{en ? "I confirm this new goal is correct and understand it will be locked for one year." : "我确认新目标准确，并理解提交后会再次锁定一年。"}</span></label>{status ? <p className="form-status">{status}</p> : null}<div className="settings-button-row"><button className="change-email" onClick={() => setEditing(false)}>{en ? "Cancel" : "取消"}</button><button className="primary-button" disabled={!confirmed || !valid} onClick={save}>{en ? "Save new scale" : "保存新刻度"}</button></div></section>;
}
