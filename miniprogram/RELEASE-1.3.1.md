# 1.3.1 — login-first entry and non-blocking startup

## Scope

- The owner reported the 1.3.0 experience test successful on 2026-09-08.
- Mini app opens the login page first. Existing sessions route locally to the dashboard without a duplicate profile read; the destination still authenticates data requests. Email login, original-account binding, optional age setup and all record/share features remain.
- Old friend-share links to `/pages/index/index` also lead guests to login. Explicitly declining consent opens `?browse=1` without looping. The browsing page's primary action is now login, not guest composition. Consent stays unchecked; browsing and separate policy links remain available.
- Existing guest drafts reached via a record route still return to the same draft after explicit successful login. Binding/unbinding routes are not intercepted by the existing-session shortcut.

## Startup changes and evidence

- Previously every localized page awaited IP locale lookup (4-second timeout), and the first database request fetched the same public service configuration again. Now page work begins immediately; last known language/device language renders first and IP language updates asynchronously. Saved profile locale retains priority.
- Startup and data APIs share one in-flight configuration request and an in-memory public-config result. Failure clears the pending request so retry works. No private records, AppSecret or login codes are cached by this change; only the language code is persisted.
- Late locale responses do not update hidden/unloaded pages; only changed date-label fields are sent rather than resending full records. Returning-user routing no longer waits for a redundant profile query.
- WeChat readiness shows a preparation state immediately. Its anonymous status timeout is 4 seconds rather than 20; actual authentication timeout and server-side checks are unchanged. Email remains available if readiness fails.
- One local read-only timing sample before changes: public config 1.274 seconds, WeChat status 1.014 seconds. These are desktop network measurements, not mobile benchmarks or a comparison between experience and release editions. We have not established that the experience edition caused the reported delay; server/network latency can remain after client startup improvements.
- No server, database region, plan or production web deployment changes are needed for this mini-only release.

## Verification and release

- All 80 tests passed; TypeScript and ESLint passed. Seven new startup tests cover immediate page work, public-config request coalescing/retry, locale priority/lifetime, existing sessions, consent refusal, old share entry and binding/draft continuation.
- Native DevTools: new login entry, unchecked consent, both login methods, explicit browsing without redirect loop and browsing-to-login primary action verified; zero debugger errors. No real account/session was changed in this pass.
- Native DevTools confirmed **1.3.1 uploaded successfully at 17:54 on 2026-09-08**, with “小程序表现良好，未发现代码质量问题”. It explicitly warned that this upload replaces the selected experience version; that update was confirmed. Online version remains 1.2.3 according to the upload form. No review submission or official publication was performed. Administrator should verify the experience version shows 1.3.1 and compare cold/warm startup on a phone before submitting review. Upload is not publication.

Suggested review description:

默认先登录再记录，支持微信一键登录并保留邮箱登录及原账户绑定；已有登录状态直接进入。优化启动语言加载与重复配置请求。协议默认不勾选，不同意仍可浏览；保留多图记录、完整长图和好友分享。
