import type { Metadata } from "next";
import { headers } from "next/headers";
import { detectLocale } from "../../lib/i18n";
import { GuidePage, type GuideCopy } from "../components/GuidePage";

export const metadata: Metadata = {
  title: "精神圣所",
  description: "写下令你安心的墓志铭与三条信条，也可以让好友留下一段致意。精神圣所默认私密，只有你亲手开启公开，其他登录用户才读得到。",
};

const copy: { zh: GuideCopy; en: GuideCopy } = {
  zh: {
    eyebrow: "SANCTUARY",
    title: "精神圣所",
    updated: "最后更新：2026年9月20日",
    lead: "圣所是一处默认私密的地方：写下你的墓志铭与三条信条，也可以让好友留下一段致意。没有你亲手开启公开，任何其他登录用户都读不到它。",
    figure: { value: "默认私密", caption: "「公开」只有你自己能打开，打开之后也随时可以关回去。" },
    facts: [
      { heading: "墓志铭", body: "写在圣所最上方的一段话，最多 200 个字，可以从「步履不停，终归星河。」改起，也可以完全重写。" },
      { heading: "三条信条", body: "你愿意反复读给自己听的三句话，每条最多 200 个字。" },
      { heading: "好友致意", body: "登录的好友可以留下一枚「星火」或「一枝花」，并附一段不超过 200 字的寄语——寄语也可以不写。" },
      { heading: "署名与计数", body: "署名和致意数量由服务端决定，客户端没有相应的写入权限。没有人能冒用别人的名义留言，也无法把计数刷高。" },
      { heading: "频次上限", body: "每位访客每小时最多留下 20 条致意，避免圣所被刷屏。" },
    ],
    sections: [
      {
        heading: "谁能看到什么",
        bullets: [
          "默认私密：只有你本人登录后才能读到自己的圣所。",
          "只有你亲手开启公开之后，其他登录用户才能读到墓志铭、信条与致意墙。",
          "访客看不到你的姓名、出生日期与目标年龄，这些字段不会随圣所一起公开。",
          "关闭公开后立即恢复为只有你可见，不需要重新编辑内容。",
        ],
        body: "圣所不是公开社交主页：它没有关注、没有推荐、没有广场，也没有「热度」这类排序。",
      },
      {
        heading: "可以撤回什么",
        bullets: [
          "你可以随时关闭公开，圣所随即回到只有你可见的状态。",
          "你可以删除圣所里的任何一条致意；访客也可以删除自己留下的那一条。",
          "注销账号会一并删除圣所内容与收到的致意。",
        ],
        body: "已公开过的内容无法追溯收回别人截图或转发，但如果关闭公开，之后任何一次访问都会重新被拒。",
      },
      {
        heading: "通过分享进入圣所的情况",
        body: "分享规则默认只分享应用本身，不带任何账号标识。唯一例外是：当你本人查看、且你的圣所已经公开时，分享卡片才会带上进入圣所的链接，链接里只有你自己的用户标识。私密圣所、他人的圣所，以及所有访客视角的分享，都会回落到应用首页卡片。未公开的记录、邮箱、出生日期、目标年龄与图片地址，在任何情况下都不会进入分享内容。",
      },
      {
        heading: "数据存在哪里",
        body: "圣所内容保存在你自己的账户下，由数据库层面的行级权限校验保护：读与写都要求你是已登录用户，并且是这条记录的所有者。匿名请求连表本身都无权访问，服务端密钥也不会出现在浏览器或小程序代码里。",
      },
    ],
    note: "圣所是留给自己和少数朋友的，不是用来表演的地方。你可以只写墓志铭不写信条，也可以把它们放在那里很久不打开——它不会催你。",
    back: "返回余生有刻",
    privacy: "隐私说明",
    language: "界面语言",
    footer: [
      { label: "双轨 1000 天", href: "/chapters" },
      { label: "精神圣所", href: "/sanctuary" },
      { label: "隐私说明", href: "/privacy" },
      { label: "服务条款", href: "/terms" },
      { label: "第三方服务", href: "/third-parties" },
      { label: "账号注销", href: "/account-deletion" },
    ],
  },
  en: {
    eyebrow: "SANCTUARY",
    title: "The sanctuary",
    updated: "Last updated: 20 September 2026",
    lead: "A sanctuary is private by default: an epitaph you write for yourself, three creeds you keep, and room for friends to leave a tribute. Until you open it yourself, no other signed-in user can read it.",
    figure: { value: "Private by default", caption: "Only you can turn publishing on, and you can turn it back off at any time." },
    facts: [
      { heading: "Epitaph", body: "The passage at the top of the sanctuary. Up to 200 characters, starting from “keep walking, and return to the stars” or rewritten entirely." },
      { heading: "Three creeds", body: "Three lines you are willing to read back to yourself, each up to 200 characters." },
      { heading: "Tributes from friends", body: "A signed-in friend can leave one spark or one flower, with an optional message of up to 200 characters." },
      { heading: "Signatures and counts", body: "The display name and the tribute count are decided server side, and the client holds no write permission for them. Nobody can post under somebody else's name, and nobody can inflate a count." },
      { heading: "Rate limit", body: "Each visitor can leave at most 20 tributes per hour, so a sanctuary cannot be flooded." },
    ],
    sections: [
      {
        heading: "Who can see what",
        bullets: [
          "Private by default: only you, signed in, can read your own sanctuary.",
          "Only after you publish it can other signed-in users read the epitaph, the creeds and the tribute wall.",
          "Visitors never see your name, birth date or target age; those fields do not travel with the sanctuary.",
          "Turning publishing off restores owner-only access immediately, with no need to edit anything.",
        ],
        body: "A sanctuary is not a public profile: there is no following, no recommendation feed, no public square and no popularity ranking.",
      },
      {
        heading: "What can be withdrawn",
        bullets: [
          "You can turn publishing off at any time, and the sanctuary becomes owner-only again.",
          "You can remove any tribute left on your sanctuary; a visitor can remove their own.",
          "Closing your account deletes the sanctuary and every tribute it received.",
        ],
        body: "Anything already published cannot be recalled from somebody else's screenshot or forward, but once publishing is off, every later visit is refused again.",
      },
      {
        heading: "Arriving through a share card",
        body: "Sharing normally sends the app itself, with no account identifier attached. The one exception: when you are the owner looking at your own sanctuary and it is published, the share card may carry a link into it, and that link contains only your own user identifier. A private sanctuary, somebody else's sanctuary, and every visitor's view all fall back to the app's home card. Unpublished entries, email addresses, birth dates, target ages and image URLs never enter any shared content.",
      },
      {
        heading: "Where the data lives",
        body: "Sanctuary content is stored under your own account and protected by row-level checks in the database: reading and writing both require a signed-in user who owns the row. Anonymous requests have no access to the tables at all, and no server key is ever shipped in the browser or mini program code.",
      },
    ],
    note: "A sanctuary is kept for yourself and a few friends, not performed for an audience. You can write an epitaph without any creeds, and you can leave it untouched for a long time. Nothing here will chase you.",
    back: "Back to LifeScale",
    privacy: "Privacy",
    language: "Interface language",
    footer: [
      { label: "1,000-day chapters", href: "/chapters" },
      { label: "The sanctuary", href: "/sanctuary" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Third parties", href: "/third-parties" },
      { label: "Delete account", href: "/account-deletion" },
    ],
  },
};

export default async function SanctuaryPage() {
  const requestHeaders = await headers();
  const country = requestHeaders.get("x-vercel-ip-country") || requestHeaders.get("cf-ipcountry") || "";
  const initialLocale = detectLocale(country, requestHeaders.get("accept-language"));
  return <GuidePage initialLocale={initialLocale} copy={copy} />;
}
