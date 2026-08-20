import { LegalPage } from "../components/LegalPage";

export default function TermsPage() {
  return <LegalPage eyebrow="A CLEAR AGREEMENT" title="Terms of Service">
    <p className="legal-lead">LifeScale is a reflection and journaling service. It is not medical advice, a life-expectancy prediction, or an emergency service.</p>
    <h2>Your account</h2><p>You must provide accurate account information, protect access to your account and use the service lawfully. You are responsible for the content you save. Do not upload unlawful content or material that infringes another person’s rights.</p>
    <h2>The life scale</h2><p>All countdown figures are mathematical illustrations based solely on the birth date and horizon you choose. They do not estimate or predict how long anyone will live and should never be used for health, financial or safety decisions.</p>
    <h2>Your content</h2><p>You retain ownership of your records. You give LifeScale only the limited permission needed to store, process, display and synchronize them for you. We do not obtain rights to sell your private records.</p>
    <h2>Availability</h2><p>We work to provide a reliable service but cannot guarantee uninterrupted availability. Features may change as the product develops. We may restrict abusive access to protect users and infrastructure.</p>
    <h2>Ending use</h2><p>You may export your records or delete your account at any time. We may suspend accounts that materially violate these terms, with notice when reasonably possible.</p>
    <h2>Contact</h2><p>Questions about these terms can be sent to <a href="mailto:support@lifescale.space">support@lifescale.space</a>.</p>
  </LegalPage>;
}
