# LifeScale 微信小程序

这是 `app.lifescale.space` 的原生微信小程序版本。它复用现有 Supabase 用户、邮箱验证码、人生刻度、每日记录和 7 天报告数据。

## 打开方式

1. 在微信开发者工具选择“导入项目”。
2. 目录选择本仓库的 `miniprogram` 文件夹。
3. 将 `project.config.json` 中的 `touristappid` 换成正式小程序 AppID。
4. 在微信公众平台配置 request 合法域名：
   - `https://app.lifescale.space`
   - `https://utcgiopwbfcmnryerynr.supabase.co`
5. 开发调试阶段可以在开发者工具中临时关闭“校验合法域名”，正式发布前必须恢复校验。

## 登录方式

仅提供邮箱六位验证码登录，不设置密码，也不接入微信、Google、Apple 或 Facebook 登录。

## 发布前仍需要

- 使用正式小程序 AppID。
- 在公众平台填写隐私保护指引。
- 完成小程序备案、类目和版本审核。
- 配置上述两个服务器域名。
