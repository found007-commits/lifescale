# 1.3.7 — clearer, independent sign-in choices

- Ordinary sign-in now says only “选择一种方式登录。” / “Choose how to sign in.” It no longer tells every user to bind an original email account. WeChat and email remain separate usable choices; the divider explicitly says “或用邮箱登录”. When WeChat is unavailable, it uses the ordinary email label instead.
- Account settings uses user-facing availability labels: “可使用邮箱登录” and, only when verified as bound, “微信已绑定，可直接登录”. Simplified Chinese, Traditional Chinese and English are synchronized.
- No authentication behavior is changed: a bound WeChat identity directly receives the original account session without an email OTP, binding prompt or new-account confirmation. Email OTP works independently without requiring WeChat binding. Unknown WeChat identities still receive the existing-account/new-account choice to prevent silently creating an empty account; only a user-selected binding flow verifies the original email.
- Explicit, initially unchecked privacy consent, binding conflict protection, deliberate new-account creation and draft return routes are unchanged. All 1.3.6 target-change rules and short tabs are retained. No web deployment or database migration is needed for this mini-only copy update.
- Verification: 109 automated tests passed, including new direct-bound-WeChat/no-email and independent-email regression cases, plus existing binding/account identity tests. TypeScript and ESLint passed. Native DevTools rendered the new guest login page with both choices and unchecked consent. No real sign-in, email sending, account changes or private-record inspection was performed during QA.
- Delivery: native WeChat DevTools confirmed **1.3.7 code upload successful at 21:09 on 2026-09-08**, with “小程序表现良好，未发现代码质量问题”. Version and description were verified before upload. The experience-build replacement was confirmed; upload form reported online version 1.2.4. **Not submitted for review or officially published**; the administrator must submit 1.3.7 and publish after approval.

Suggested review description:

优化登录页文案与登录方式展示：支持微信或邮箱验证码独立登录；已绑定微信可直接进入原账户，无需重复绑定或验证邮箱。仅在尚未绑定且选择关联原账户时验证邮箱。保留主动隐私同意、老账户记录保护及1.3.6目标修改规则和简洁导航。
