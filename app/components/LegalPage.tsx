import { Brand } from "./Brand";

export function LegalPage({ eyebrow, title, updated = "August 20, 2026", children }: { eyebrow: string; title: string; updated?: string; children: React.ReactNode }) {
  return <main className="legal-shell"><header className="legal-header"><Brand /><a href="/">Back to LifeScale</a></header><article className="legal-content"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p className="legal-updated">Last updated {updated}</p>{children}</article><footer className="legal-footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/third-parties">Third parties</a><a href="/account-deletion">Account deletion</a></footer></main>;
}
