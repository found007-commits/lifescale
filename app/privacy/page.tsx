import { LegalPage } from "../components/LegalPage";

export default function PrivacyPage() {
  return <LegalPage eyebrow="YOUR DATA, YOUR LIFE" title="Privacy Notice">
    <p className="legal-lead">LifeScale is built as a private personal space. We collect only what is needed to provide your account, life scale, and personal records.</p>
    <h2>What we collect</h2><p>We process your account identifier, email address, optional profile image, sign-in provider, birth date and chosen life horizon, language, country and timezone, and the personal records you choose to save. Technical security data may include IP address, browser information and session identifiers.</p>
    <h2>Why we use it</h2><p>We use this information to authenticate you, calculate your personal life scale, save and sync your records, select an appropriate language, protect the service, respond to support requests and comply with law. We do not sell personal information and do not use your private records for advertising.</p>
    <h2>Legal bases and international access</h2><p>Where GDPR or similar law applies, processing is based on providing the service you request, protecting the service and users, meeting legal obligations, and consent where required. Service providers may process data in other countries using appropriate contractual and organizational safeguards.</p>
    <h2>Retention and control</h2><p>Your account data is retained while your account remains active. Deleted personal records are removed from active systems; limited security or legal records may be retained only when required. You can export your information or permanently delete your account from Settings.</p>
    <h2>Your rights</h2><p>Depending on your location, you may request access, correction, portability, deletion, restriction, objection, or withdrawal of consent. You may also complain to your local data protection authority.</p>
    <h2>Children</h2><p>LifeScale is not directed to children under 16, or the minimum digital consent age in their country. We do not knowingly create accounts for children without valid parental authorization.</p>
    <h2>Contact</h2><p>Privacy questions and rights requests can be sent to <a href="mailto:privacy@lifescale.space">privacy@lifescale.space</a>.</p>
  </LegalPage>;
}
