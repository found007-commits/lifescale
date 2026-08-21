import { LegalPage } from "../components/LegalPage";

export default function AccountDeletionPage() {
  return <LegalPage eyebrow="由你决定" title="注销账号">
    <p className="legal-lead">你可以随时永久删除人生刻度账号和全部已保存的人生记录。</p>
    <h2>在人生刻度中注销</h2><ol><li>登录人生刻度账号。</li><li>打开<strong>个人与数据</strong>。</li><li>选择<strong>永久注销账号并删除数据</strong>。</li><li>完成两次删除确认。</li></ol>
    <h2>注销会删除什么</h2><p>你的个人资料、关联登录信息、有效会话、人生刻度设置和个人记录都会从当前系统中删除。为证明注销请求已经完成，我们可能只保留不可逆摘要和最少量的完成记录，不会保留人生簿内容。</p>
    <h2>无法登录时</h2><p>请使用账号关联邮箱发送邮件至 <a href="mailto:privacy@lifescale.space?subject=LifeScale%20account%20deletion">privacy@lifescale.space</a>。我们会先验证账号控制权，再处理注销请求。</p>
  </LegalPage>;
}
