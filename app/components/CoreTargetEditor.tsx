"use client";
import { useEffect, useState } from "react";
import type { LifeProfile } from "../../lib/types";
import { updateProfile } from "../../lib/lifescale-data";
import { targetDateFromAge, todayInTimeZone } from "../../lib/life-calculations";
import { targetPolicy, targetError, RULE_ZH, RULE_EN } from "../../miniprogram/utils/target-policy";
import { TargetAgeField } from "./TargetAgeField";

export function CoreTargetEditor({ profile, onUpdated }: { profile: LifeProfile; onUpdated: (profile: LifeProfile) => void }) {
  const en = profile.locale === "en";
  const [age, setAge] = useState(String(profile.target_age || ""));
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const policy = targetPolicy(profile, now);
  const target = Number(age);
  const valid = Number.isInteger(target) && target >= 30 && target <= 150 && targetDateFromAge(profile.birth_date, target) > todayInTimeZone(profile.timezone);
  const changed = valid && (target !== profile.target_age || targetDateFromAge(profile.birth_date, target) !== profile.target_date);
  const nextAt = policy.nextAt ? new Date(policy.nextAt).toLocaleString(en ? "en-GB" : profile.locale === "zh-TW" ? "zh-TW" : "zh-CN", { timeZone: profile.timezone }) : "";
  async function save() {
    if (busy || !valid || !changed || !targetPolicy(profile).canChange) return;
    setBusy(true); setError("");
    try {
      const updated = await updateProfile(profile.id, { target_age: target, target_date: targetDateFromAge(profile.birth_date, target) });
      onUpdated(updated); setConfirming(false); setNow(Date.now());
    } catch (caught) { setError(targetError(caught instanceof Error ? caught.message : "保存失败，请重试。", en)); }
    finally { setBusy(false); }
  }
  return <section className="settings-card locked-profile-card">
    <div className="settings-title-row"><h2>{en ? "Core life scale" : "核心余生刻度"}</h2><span>{en ? "Up to 3 adjustments" : "累计最多调整 3 次"}</span></div>
    <p>{en ? RULE_EN : RULE_ZH}</p>
    <dl><div><dt>{en ? "Birth date (fixed)" : "出生日期（不可修改）"}</dt><dd>{profile.birth_date}</dd></div><div><dt>{en ? "Target date" : "目标日期"}</dt><dd>{profile.target_date}</dd></div><div><dt>{en ? "Target age" : "目标年龄"}</dt><dd>{profile.target_age || (en ? "Exact date" : "具体日期")}</dd></div><div><dt>{en ? "Adjustments remaining" : "剩余调整次数"}</dt><dd>{policy.configured ? policy.remaining + " / 3" : "—"}</dd></div></dl>
    <p className="upload-hint">{!policy.configured ? (en ? "Adjustment status unavailable. Refresh before changing your target." : "暂时无法读取调整资格，请刷新后重试。") : !policy.remaining ? (en ? "All 3 adjustments have been used." : "累计 3 次调整机会已用完。") : policy.canChange ? (en ? "You can adjust your target now." : "已满一年，现在可以调整目标。") : (en ? "Next available: " : "下次可调整：") + nextAt}</p>
    {policy.canChange ? <><TargetAgeField locale={profile.locale} minimumAge={30} value={age} onChange={(value) => { if (!busy) { setAge(value); setConfirming(false); } }} /><button className="primary-button" disabled={!changed || busy} onClick={() => { setError(""); setConfirming(true); }}>{en ? "Adjust target" : "调整目标年龄"}</button></> : null}
    {confirming ? <div className="modal-backdrop danger-confirm-backdrop"><section className="danger-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="target-confirm-title"><h2 id="target-confirm-title">{en ? "Confirm this adjustment?" : "确认调整目标？"}</h2><p>{en ? "New target: " : "新目标："}{age}{en ? " years." : " 岁。"} {en ? "This uses one adjustment. You will have " : "本次将使用一次机会，之后剩余 "}{Math.max(0, policy.remaining - 1)}{en ? ". The next adjustment requires another full year." : " 次；下次调整需再满一年。"}</p>{error ? <p role="alert">{error}</p> : null}<div className="danger-confirm-actions"><button className="outline-button" disabled={busy} onClick={() => setConfirming(false)}>{en ? "Cancel" : "取消"}</button><button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? (en ? "Saving…" : "正在保存…") : (en ? "Confirm" : "确认调整")}</button></div></section></div> : null}
  </section>;
}
