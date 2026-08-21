import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="LifeScale home">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-tick" />
        <span className="brand-dot" />
      </span>
      <span className="brand-type"><b>LifeScale</b>{!compact && <small>MAKE TIME YOUR OWN</small>}</span>
    </Link>
  );
}
