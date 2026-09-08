# 1.3.6 — target corrections and shorter navigation

## Changes

- A target's initial setup does not consume a change. In the first calendar year after profile creation, up to three changes can be made without a waiting period. Starting at the first anniversary, changes require a full calendar year between them. The lifetime maximum is seven, including first-year changes. Unused first-year opportunities do not allow multiple changes in later years. This is not a January 1 reset.
- Existing creation times, targets and used counts are preserved. Birth dates remain fixed. Settings separates first-year remaining opportunities, total remaining opportunities and the next available date. Confirmation explains the actual next wait, including the third first-year and final lifetime change.
- PostgreSQL migration `20260908210000_flexible_target_adjustments.sql` enforces the rule, keeps counters/timestamps server-managed and retains the current ownership rules. No backfill or resetting user records. UTC calendar arithmetic clamps leap-day anniversaries consistently with the shared client policy.
- Mini navigation is now **历史 / 今天 / 小回顾 / 设置**, routing to history / dashboard / report / settings respectively. English is **History / Today / Review / Settings**. The existing time dial and recording entry remain on Today; this does not remove any existing page capability.
- Settings help text uses separate block lines, avoiding run-together counts and timestamps. Simplified Chinese, Traditional Chinese and English labels are included. Setup, guest preview, account rules and web pages have matching policy copy.
- No changes to records, multi-photo sharing, private visibility, deletion confirmation or WeChat/email account binding. No public feed.

## Verification

- 106 automated tests passed; TypeScript, ESLint and production builds passed.
- Actual PostgreSQL (PGlite) migration tests verify preserved old rows, three immediate first-year changes, exact anniversary eligibility, annual lock, seven-change maximum, free no-op/preference saves and protected birth dates/counters/timestamps. Shared-policy tests cover leap-day anniversaries, malformed data and localized confirmation wording. Navigation tests cover native route order and live localized labels.
- Native WeChat DevTools rendered the actual settings WXML/WXSS with synthetic-only local data and the four short English tabs. Counts and the adjustment entry fit the phone layout. Temporary fixture pages and app configuration were removed/restored before final tests and upload; no real accounts or records were read or modified during testing. Real-phone account adjustment remains an acceptance check because it consumes an opportunity.

## Delivery

- Database migration applied successfully; a subsequent dry-run reported the remote database up to date.
- Production website: https://app.lifescale.space
- Deployment: `dpl_E96pU7MbDCMRkz97HFyLxzD5SBLq`, production, **READY**. Remote production build completed in 19 seconds. This supersedes the initial deployment `dpl_Aw789fAMob5H3HYWbSgUuYRmzWnV` with all entry-point/legal policy copy synchronized.
- WeChat DevTools confirmed **1.3.6 code upload successful at 21:00 on 2026-09-08**. Code quality: “小程序表现良好，未发现代码质量问题”. Version and description were re-read before upload. Upload form reported online version 1.2.4.
- **Not submitted for review and not officially published.** Administrator must submit 1.3.6 for review and publish after approval. Uploading the experience build is not publication.

Suggested review description:

目标年龄首次设定后一年内可修改3次，满一年后每次修改间隔一年，累计最多7次；首次设定不计次数，已有次数保留。增加首年及累计剩余次数、下次可修改时间和确认提示。底部精简为历史、今天、小回顾、设置，同步中英文短标签，修复提示拥挤。保留原有记录、登录绑定、私密分享和删除确认。
