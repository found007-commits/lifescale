const Page = require("../../utils/localized-page");
const documents = {
  privacy: {
    title: "隐私政策",
    updated: "更新于 2026 年 9 月 7 日",
    sections: [
      { heading: "我们收集什么", body: "为提供余生有刻 LifeScale 服务，我们会处理你的邮箱地址、出生日期、人生目标、显示名称、语言及显示偏好、个人记录、心情分类和你主动上传的照片。性别选项由你自行选择，也可选择保密，不用于广告画像或决定人生目标。" },
      { heading: "数据如何使用", body: "这些数据仅用于账户登录、计算你设定的人生刻度、保存记录和生成个人 7 天报告。我们不会出售你的个人数据。" },
      { heading: "谁能看到", body: "个人记录和照片默认仅自己可见，数据库和存储按账户隔离。产品没有供创作者浏览私密记录的管理入口，但这不等于端到端加密；具备基础设施管理权限的服务方仍可能在必要运维时处理数据。" },
      { heading: "自主分享", body: "仅在你主动点击分享并确认发送后，预览中的文字与照片副本才会提供给你选择的接收方。分享卡在设备上生成，不含邮箱、出生日期、性别或人生目标。对方可能保存或转发副本，请自行决定分享范围。" },
      { heading: "相册权限", body: "只有你选择照片或主动保存分享卡时，才会请求相应的照片或相册权限。拒绝保存权限不影响记录和图片预览。" },
      { heading: "保存与删除", body: "你可以在“我的”页面永久注销账户。注销后，个人资料、记录和照片将被永久删除，无法恢复。" },
      { heading: "联系我们", body: "如有隐私问题，请通过 lifescale.space 官网提供的联系方式与我们联系。" },
    ],
  },
  terms: {
    title: "服务条款",
    updated: "更新于 2026 年 8 月 21 日",
    sections: [
      { heading: "服务性质", body: "余生有刻是 LifeScale 旗下的个人时间目标和生活记录工具，不提供医疗、寿命预测、法律或财务建议。" },
      { heading: "账户责任", body: "你需要使用本人可访问的邮箱登录，并对自己填写和上传的内容负责。请勿上传违法或侵害他人权益的内容。" },
      { heading: "重要数据", body: "出生日期和人生目标只能确认一次，保存后永久锁定，不能单独修改。如需清除，只能注销整个账户。" },
      { heading: "服务变化", body: "我们可能为安全、合规和产品改进调整功能。重大变化会在产品内给出说明。" },
    ],
  },
  third: {
    title: "第三方服务说明",
    updated: "更新于 2026 年 8 月 21 日",
    sections: [
      { heading: "Supabase", body: "用于邮箱验证码登录、数据库和私密照片存储。相关请求只传输完成这些功能所需的数据。" },
      { heading: "Vercel", body: "用于托管 app.lifescale.space 的应用接口和静态资源。" },
      { heading: "微信小程序平台", body: "用于运行本小程序。微信可能按照其平台规则处理必要的设备、网络和运行日志信息。" },
      { heading: "登录方式", body: "当前仅提供邮箱验证码登录，不接入微信、Google、Apple 或 Facebook 登录。" },
    ],
  },
};

Page({
  data: { document: documents.privacy },
  onLoad(options) {
    const document = documents[options.type] || documents.privacy;
    this.setData({ document });
    wx.setNavigationBarTitle({ title: document.title });
  },
});
