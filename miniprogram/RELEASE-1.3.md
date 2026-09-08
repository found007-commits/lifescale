# 1.3.0 — optional WeChat login, existing-account binding

## User flows

- Email OTP remains available and uses the same accounts, RLS and refresh sessions.
- WeChat already linked: sign in to the existing canonical user ID.
- WeChat unlinked: show **Link my existing email account** first, or **I'm new here**. The initial WeChat attempt never creates an account.
- Existing account: verify the original email OTP with account creation disabled; add a unique WeChat mapping without moving, merging or overwriting records/profile/age quotas.
- New account: requires an additional explicit confirmation that old email records will not appear. The backend creates a reserved internal identifier, never asks for a phone number, nickname or avatar. Internal email placeholders are hidden in the mini UI.
- Conflict: never reassign a mapping. Explain the conflict and let the user enter only the email account they just verified.
- Signed-in email accounts can bind/unbind from **Preferences → Sign-in methods**. Both require fresh email verification. Unlink does not end existing sessions; it removes future WeChat sign-in for that account. A WeChat-only account cannot remove its sole login method.
- WeChat-only and older email accounts are not merged. Existing email users should choose binding, not new-account creation. Adding a new real email to a WeChat-only account is not implemented in this release.
- Consent remains unchecked by default, with separate links. No `wx.login` call before active opt-in and a button tap. Guest composition and its return-to-save path remain intact.
- Simplified Chinese, Traditional Chinese and English copy included. Existing friend-only sharing, multi-photo layouts and annual age rules are unchanged.

## Server and security

- App ID: `wxa1ad4ff408b7727d`.
- `POST /api/miniprogram/wechat` exchanges a fresh `wx.login` code on the server. Caller-provided OpenID or user ID is never trusted.
- AppSecret exists only as Vercel Production variable `WECHAT_MINIPROGRAM_APP_SECRET`. Never prefix with `NEXT_PUBLIC_`, include in the mini package or paste into chat.
- Activation requires `WECHAT_LOGIN_ENABLED=true` **and** a nonempty AppSecret. Keep the flag off until credentials and the migration are verified.
- Only an SHA-256 digest of app ID + OpenID is stored in `wechat_identities`. No session_key, UnionID or raw OpenID persistence. Unique subject and account constraints prevent binding reassignment. Deletion of auth.users cascades to the mapping.
- Existing-account binding proves email possession; account management additionally verifies the signed-in identity. No nickname matching, mass migration or auth bypass for reviewers.
- Admin-generated email token hashes are verified server-side to issue ordinary Supabase sessions, never exposed to the mini app. Session user IDs and binding ownership are rechecked. Verified MFA users must use their existing email flow.
- Shared Postgres rate limits cover IP hashes, one-use code hashes and subject hashes. Tables and security-definer functions deny anon/authenticated access. Service role has no UPDATE permission on mappings. HTTP responses are no-store and suppress upstream credential-bearing errors.

## Validation and release state — 2026-09-08

- 73 automated tests passed, including old-account identity continuity, conflicts, replay, missing consent, failed OTP, concurrent create/bind, unlink protections, guest-draft continuation and existing sharing features.
- In-memory Postgres executes the real migration, verifies role restrictions (including Supabase-style default grants), uniqueness, rate windows, recovery RPC and deletion cascade, using synthetic records only.
- TypeScript, ESLint and production build passed with the existing pinned Supabase 2.112.3 dependency.
- Native WeChat DevTools preview: checkbox remains unchecked, disabled buttons readable, English choice/binding layouts fit the simulator. Display-only preview did not bind, sign in or modify any real account. After activation, the unmodified login page fetched readiness and displayed both WeChat and email methods with consent still unchecked.
- Applied only migration `20260908170000_wechat_login.sql` to linked project `utcgiopwbfcmnryerynr`. Existing user data untouched. Production anon read of the binding table returned HTTP 401 / PostgreSQL 42501.
- Owner saved Production `WECHAT_MINIPROGRAM_APP_SECRET`; confirmed only name, scope and Secret type without reading its value. Added `WECHAT_LOGIN_ENABLED=true`. Activated backend deployed to `https://app.lifescale.space`, deployment `dpl_BfmpTbxYugeru7DungrojsLues7R`, READY (Next.js; remote build 26 seconds; implementation commit `7d1e2ce`).
- Production smoke checks: readiness HTTP 200 / enabled true; missing consent HTTP 403 / CONSENT_REQUIRED; invalid Bearer status HTTP 401 / UNAUTHORIZED; homepage HTTP 200. Authentication responses retain private, no-store. No broad production log/user-data scan was performed.
- Re-ran all 17 WeChat-specific core, client and real-migration tests: passed. A fresh native DevTools `wx.login` code was exchanged through the Production login endpoint as a developer connectivity diagnostic: HTTP 200, needsAccountChoice true, no session returned. No account creation, binding, record access or session persistence was performed; only status/booleans were printed. This validates AppSecret/provider/database connectivity, not the complete real-account binding/session flow.
- **Mini 1.3.0 uploaded successfully at 17:41 on 2026-09-08** through native WeChat DevTools. Receipt: “代码上传成功”; scan: “小程序表现良好，未发现代码质量问题”. It has not been submitted for review or published. The upload dialog reported online version 1.2.3. Existing online/review versions were not withdrawn or replaced.

## Remaining activation checklist

1. Administrator sets uploaded **1.3.0** as the experience version in the WeChat console.
2. Owner chooses **Link my existing email account**, verifies the original email once, then signs out and signs in with WeChat. Confirm the same records and age target remain. Use a dedicated disposable test identity for the new-account flow; do not test it using an old user's WeChat identity by mistake. Never create a reviewer backdoor.
3. Update WeChat privacy declarations to accurately cover optional OpenID/login handling as well as email and user-selected photos. Retain active, unchecked consent.
4. After experience acceptance, administrator submits **1.3.0** for code review, then publishes after approval. Current automation cannot operate the WeChat public-platform admin webpage. Do not describe the development upload as live.

Suggested review description:

新增可选微信一键登录，保留邮箱验证码登录；老用户验证原邮箱后绑定微信，原记录与人生目标不变。未绑定微信先选择已有账户或新用户，不自动新建或合并。新增登录方式管理，协议默认不勾选；保留多图记录及好友分享。
