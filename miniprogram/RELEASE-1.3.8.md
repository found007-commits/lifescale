# 1.3.8 — WeChat first-time setup

- Unknown WeChat identities still choose between binding an existing email account and explicitly creating a new account. Selecting “我是新用户” now directly creates the account and opens personal setup. Removed the redundant native confirmation modal whose five-character confirm label was rejected by WeChat, silently preventing registration.
- New WeChat-only accounts must complete birth date, target age, gender (including private), and explicit data confirmation; nickname remains optional. They then enter Today. Reopening an unfinished account returns to setup. A completed bound account signs into its original records; independent email login remains available and does not require WeChat binding.
- A guest composition is preserved in the existing page stack across login and setup, and resumes saving only after setup succeeds. Backing out of setup cannot bypass the record-save guard. No record is written by setup itself. Closing the app still discards an unsaved in-memory draft, as already disclosed in the composer.
- The first-year three adjustments / seven total target-age rule, short navigation, private records, deletion confirmation and existing sharing features are retained. No database migration or web deployment is required.
- Verification: 116 automated tests passed; TypeScript and ESLint passed. Coverage includes explicit choice and consent, repeated taps, retryable errors, original account preservation, setup ownership, incomplete-session startup, validation, draft return and exactly-once record saving. Native DevTools rendered required setup with no skip button and blocked an empty submission with “请填写出生日期。” using a synthetic in-memory session and disabled network. Test overrides were restored; no real account was created and no private record was inspected. Real-device WeChat registration is still a final acceptance check.
- Delivery: native WeChat DevTools confirmed **1.3.8 code upload successful at 21:29 on 2026-09-08**, with “小程序表现良好，未发现代码质量问题”. Version and note were verified before upload; replacement of the previous experience build was confirmed. Not submitted for review or published; the administrator must submit this version and publish after approval.

Suggested review description:

修复微信新用户按钮无响应：选择新用户后直接注册，先完成个人资料、出生日期和目标年龄设定，再进入每日记录；未完成设定可继续办理，原有草稿保留。邮箱独立登录、已有账户绑定与原记录保护、主动隐私同意及分享功能不变。
