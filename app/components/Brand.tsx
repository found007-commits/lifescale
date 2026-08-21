import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="余生有刻 LifeScale 首页">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-tick" />
        <span className="brand-dot" />
      </span>
      <span className="brand-type"><b>余生有刻</b>{!compact && <small>LIFESCALE</small>}</span>
    </Link>
  );
}
