import { LegalPage } from "../components/LegalPage";

export default function ThirdPartiesPage() {
  return <LegalPage eyebrow="TRANSPARENT BY DESIGN" title="Third-Party Services">
    <p className="legal-lead">We use a small set of service providers to operate LifeScale. Private life records are never shared for third-party advertising.</p>
    <div className="third-party-list">
      <section><h2>OpenAI Sites & Cloudflare</h2><p>Application hosting, network delivery, database infrastructure, security and country-level request information.</p></section>
      <section><h2>Google</h2><p>Optional Google account sign-in. Google shares the basic profile information you approve.</p></section>
      <section><h2>Apple</h2><p>Optional Sign in with Apple. Apple may provide a private relay email depending on your selection.</p></section>
      <section><h2>Meta / Facebook</h2><p>Optional Facebook account sign-in. Meta shares the basic profile information you approve.</p></section>
      <section><h2>Resend</h2><p>Delivery of one-time email sign-in codes and essential service messages.</p></section>
      <section><h2>Better Auth</h2><p>Open-source authentication software runs within LifeScale infrastructure; it is not a separate data recipient.</p></section>
    </div>
    <p>Provider availability may vary by region. This list will be updated before any materially different service begins processing personal information.</p>
  </LegalPage>;
}
