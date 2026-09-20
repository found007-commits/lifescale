const Page = require("../../../../utils/localized-page");
const { addSanctuaryTribute, requireSession } = require("../../../../utils/supabase");
const { uuid } = require("../../../../utils/life");
const t = require("../../../../utils/locale-copy");

const MAX_LENGTH = 200;

// A tribute kind is a closed set in the database (public.sanctuary_tribute_kind), so the
// page offers exactly those two and nothing else can be posted.
const KINDS = [
  { key: "spark", label: "星火" },
  { key: "flower", label: "一枝花" },
];

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Page({
  data: {
    loading: true,
    error: "",
    ready: false,
    kinds: KINDS,
    kind: "spark",
    message: "",
    sending: false,
  },

  onLoad(query) {
    const raw = typeof query?.uid === "string" ? query.uid.trim() : "";
    this.targetUserId = isUuid(raw) ? raw : "";
    // One id per attempt. A retry after a timeout reuses it, so the database collapses the
    // duplicate into the row that already exists instead of spending the hourly budget twice.
    this.tributeId = uuid();
  },

  onShow() { return this.load(); },

  load() {
    const session = requireSession();
    if (!session) return;
    const me = session.user.id;
    if (!this.targetUserId) return this.setData({ loading: false, ready: false, error: t("没有找到要致意的对象，请从对方的圣所进入。", this.data.locale) });
    if (this.targetUserId === me) return this.setData({ loading: false, ready: false, error: t("这是一段留给对方的字，不能写给自己。", this.data.locale) });
    this.setData({ loading: false, ready: true, error: "" });
  },

  chooseKind(event) {
    const kind = event.currentTarget.dataset.kind;
    if (!KINDS.some((item) => item.key === kind)) return;
    this.setData({ kind });
  },

  onMessageInput(event) { this.setData({ message: event.detail.value }); },

  async send() {
    if (this.data.sending || !this.data.ready) return;
    const locale = this.data.locale;
    const message = String(this.data.message || "").trim();
    if (message.length > MAX_LENGTH) return this.setData({ error: t("寄语请控制在 200 个字以内。", locale) });
    this.setData({ sending: true, error: "" });
    try {
      await addSanctuaryTribute(this.targetUserId, this.data.kind, message, this.tributeId);
      // The next tribute from this page must be a new row, not the one just delivered.
      this.tributeId = uuid();
      this.setData({ sending: false, message: "" });
      wx.showToast({ title: t("已送达", locale), icon: "success" });
      wx.navigateBack({ fail: () => wx.redirectTo({ url: "/subpackages/sanctuary/pages/space/space" }) });
    } catch (error) {
      this.setData({ sending: false, error: this.explain(error, locale) });
    }
  },

  // The database answers in English for the two cases that matter, and a bare 403 is what
  // an unpublished sanctuary returns, so both are turned into product copy here.
  explain(error, locale) {
    if (/Too many tributes/i.test(error.message || "")) return t("刚才留得有点多，请过一会儿再试。", locale);
    if (error.status === 403 || /row-level security|permission denied/i.test(error.message || "")) {
      return t("对方还没有公开圣所，暂时无法留下致意。", locale);
    }
    return error.message || t("致意没有送达，请稍后重试。", locale);
  },
});
