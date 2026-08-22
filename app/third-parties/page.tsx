import { LegalPage } from "../components/LegalPage";

export default function ThirdPartiesPage() {
  return <LegalPage eyebrow="透明，从设计开始" title="第三方服务">
    <p className="legal-lead">我们仅使用少量服务提供商来运行余生有刻，绝不会把私密人生记录用于第三方广告。</p>
    <div className="third-party-list">
      <section><h2>Vercel</h2><p>用于应用托管、网络传输、服务端功能和安全防护，可能处理请求 IP、浏览器信息、访问时间与必要安全日志。</p></section>
      <section><h2>Supabase</h2><p>用于邮箱验证码登录、PostgreSQL 云端数据库、跨设备同步、私密图片存储与行级访问控制，处理账号标识、邮箱、用户主动保存的数据及必要安全日志。</p></section>
      <section><h2>邮件投递服务</h2><p>用于发送登录验证码，处理收件邮箱、发送时间、投递状态及防滥用所需的最少技术信息。</p></section>
      <section><h2>你的浏览器</h2><p>只保存明暗主题、未登录预览和临时草稿等非权威界面状态；正式用户数据以云端为准。</p></section>
    </div>
    <p>目前未启用 Google、Apple 和 Facebook 登录。第三方云服务依照各自权限承担认证、存储、传输与安全等必要处理；它们不是创作者用于浏览用户私密记录的内容后台。如未来有性质明显不同的服务开始处理个人信息，我们会先更新本页面。</p>
  </LegalPage>;
}
