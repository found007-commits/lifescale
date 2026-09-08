# 1.3.9 — distinct gentle and clear modes

- Gentle mode uses a pale green panel, a slim circular dial and a calm message. Clear mode uses a charcoal panel, a peach active selection, large sans-serif day count, visible goal progress, lived days and remaining weeks. The contrast is structural and informational, not just a label change.
- Both modes use the same existing target calculation. The card explicitly states that the result is based on the user's chosen target age, not a lifespan prediction. Beyond the target, both show positive bonus days; clear mode hides remaining weeks and labels the target as exceeded.
- Switching updates the view immediately and saves only `display_mode`. Duplicate/same-mode changes are ignored; a failed save restores the prior view and displays the error. No record, age goal or other preference is changed.
- English and Traditional Chinese are included. Fixed wrapping of long dashboard headings. Existing record-first CTA, expandable time details, sharing, deletion, login and target-adjustment rules are retained. This is a mini-only release, with no web deployment or database migration.
- Verification: 121 tests, TypeScript and ESLint passed. Tests cover both layout branches, template expression syntax, translation coverage, preserved fields, immediate switching, locking and failed-save rollback. Native DevTools checked both modes in Chinese and English, including bonus days and long-heading wrapping, using synthetic in-memory profile data with network requests intercepted locally. No real records or account preferences were accessed or modified; test overrides were restored.
- Delivery: native DevTools confirmed **1.3.9 code upload successful on 2026-09-08 at 21:48**, with no code-quality issues found. Version and note were verified before upload; replacement of the previous experience build was confirmed. Not submitted for review or published.

Suggested review description:

优化温和与清醒模式的视觉和信息对比：温和模式采用浅色圆环与舒缓提示；清醒模式采用深色大数字，并直观展示设定目标进度、已走过天数及剩余周数。切换即时反馈，失败可恢复。明确提示非寿命预测，保留原有记录、分享、登录与年龄规则。
