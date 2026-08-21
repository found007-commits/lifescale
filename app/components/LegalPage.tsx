import Link from "next/link";
import { Brand } from "./Brand";

export function LegalPage({ eyebrow, title, updated = "2026年8月20日", children }: { eyebrow: string; title: string; updated?: string; children: React.ReactNode }) {
  return <main className="legal-shell"><header className="legal-header"><Brand /><Link href="/">返回余生有刻</Link></header><article className="legal-content"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p className="legal-updated">最后更新：{updated}</p>{children}</article><footer className="legal-footer"><Link href="/privacy">隐私说明</Link><Link href="/terms">服务条款</Link><Link href="/third-parties">第三方服务</Link><Link href="/account-deletion">账号注销</Link></footer></main>;
}
