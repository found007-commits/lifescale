# 人生刻度 LifeScale｜微信云托管部署包

这是 `lifescale.space` 官网的 Express 部署包，适配微信云托管。包含首页、隐私政策、用户协议、第三方信息共享清单和账号注销说明。

## 云托管配置

- 运行环境：Node.js 20（也可直接使用根目录 `Dockerfile`）
- 启动命令：`npm start`
- 容器端口：`80`
- 健康检查：`/healthz`

## 发布流程

1. 在微信云托管服务 `express-p9zn-001` 中进入“基于模板开发”或代码发布入口。
2. 上传本项目全部文件，或将项目导入代码仓库后关联云托管。
3. 构建方式选择 Dockerfile；服务端口填写 `80`，健康检查路径填写 `/healthz`。
4. 发布成功后，先用“公网域名访问”测试以下地址：`/`、`/privacy`、`/terms`、`/third-parties`、`/account-deletion`。
5. 在云托管“自定义域名”中添加 `lifescale.space` 和 `www.lifescale.space`，再到阿里云 DNS 按云托管页面给出的记录值添加解析。

> 不要再把域名解析到 `chatgpt.site`。DNS 记录以微信云托管“自定义域名”页面实时给出的目标值为准。

## 本地检查

```bash
npm install
npm run check
PORT=8080 npm start
```
