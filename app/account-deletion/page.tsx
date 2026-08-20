import { LegalPage } from "../components/LegalPage";

export default function AccountDeletionPage() {
  return <LegalPage eyebrow="YOUR CHOICE" title="Delete Your Account">
    <p className="legal-lead">You can permanently delete your LifeScale account and all saved life records at any time.</p>
    <h2>Delete inside LifeScale</h2><ol><li>Sign in to your LifeScale account.</li><li>Open <strong>Settings</strong>.</li><li>Select <strong>Permanently delete account</strong>.</li><li>Confirm the two deletion prompts.</li></ol>
    <h2>What deletion removes</h2><p>Your profile, connected sign-in accounts, active sessions, life-scale settings and personal records are removed from active systems. A one-way hash and minimal completion record may be retained to document that the request was fulfilled, without retaining your journal content.</p>
    <h2>If you cannot sign in</h2><p>Email <a href="mailto:privacy@lifescale.space?subject=LifeScale%20account%20deletion">privacy@lifescale.space</a> from the address connected to your account. We will verify control of the account before processing the request.</p>
  </LegalPage>;
}
