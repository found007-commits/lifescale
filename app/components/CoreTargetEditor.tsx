import type { LifeProfile } from "../../lib/types";

export function CoreTargetEditor({ profile }: { profile: LifeProfile; onUpdated: (profile: LifeProfile) => void }) {
  const en = profile.locale === "en";
  return <section className="settings-card locked-profile-card"><div className="settings-title-row"><h2>{en ? "Core life scale" : "核心余生刻度"}</h2><span>{en ? "Confirmed once" : "已永久确认"}</span></div><p>{en ? "This is a personal life-time goal, not a death prediction." : "这不是死亡预测，而是你为自己设定的人生时间目标。"}</p><dl><div><dt>{en ? "Birth date" : "出生日期"}</dt><dd>{profile.birth_date}</dd></div><div><dt>{en ? "Target date" : "目标日期"}</dt><dd>{profile.target_date}</dd></div><div><dt>{en ? "Target method" : "目标方式"}</dt><dd>{profile.target_age ? `${profile.target_age}${en ? " years" : " 岁"}` : (en ? "Exact date" : "具体日期")}</dd></div><div><dt>{en ? "Confirmation" : "确认规则"}</dt><dd>{en ? "Permanent" : "仅一次"}</dd></div></dl><small>{en ? "The server permanently rejects separate changes to your birth date and core target. To erase them, delete the entire account." : "服务端会永久拒绝对出生日期和核心目标的单独修改；如需清除，只能注销整个账户。"}</small></section>;
}
