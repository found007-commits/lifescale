const Page = require("../../../../utils/localized-page");
const {
  deleteSanctuaryTribute,
  getProfile,
  getSanctuaryProfile,
  listSanctuaryTributes,
  requireSession,
} = require("../../../../utils/supabase");
const { calculateChapterMetrics, calculateLifeMetrics } = require("../../../../utils/life");
const { chapterCopy, tributeCountLabel: countLabel } = require("../../../../utils/sanctuary-copy");
const { formatDate } = require("../../../../utils/share-card");
const t = require("../../../../utils/locale-copy");

const SPACE_PATH = "/subpackages/sanctuary/pages/space/space";
const SELF_PATH = "/subpackages/sanctuary/pages/editor/editor";
const TRIBUTE_PATH = "/subpackages/sanctuary/pages/tribute/tribute";

// guest_name is decided by the database from the guest's own profile, so it is rendered
// as data and never re-derived here.
function decorateTribute(row, me, isOwner, locale) {
  const own = row.guest_user_id === me;
  return {
    id: row.id,
    name: row.guest_name || t("同行者", locale),
    kind: row.tribute_kind,
    kindLabel: row.tribute_kind === "flower" ? "一枝花" : "星火",
    message: row.message || "",
    dateLabel: formatDate(row.created_at, locale),
    own,
    removable: isOwner || own,
  };
}

Page({
  data: {
    loading: true,
    error: "",
    isOwner: false,
    sanctuary: null,
    tributes: [],
    tributeCountLabel: "",
    chapter: null,
    chapterLabels: {},
    removing: false,
  },

  onLoad(query) {
    // A uid arrives from a shared public sanctuary. Anything that is not a uuid is
    // dropped so the page can never be steered with a half-formed identifier.
    const raw = typeof query?.uid === "string" ? query.uid.trim() : "";
    this.targetUserId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : "";
  },

  onShow() { return this.load(); },
  onPullDownRefresh() { return this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh()); },

  async load() {
    const session = requireSession();
    if (!session) return;
    const me = session.user.id;
    const target = this.targetUserId || me;
    const isOwner = target === me;
    this.setData({ loading: true, error: "" });
    try {
      const sanctuary = await getSanctuaryProfile(target);
      // An unpublished row and a row that was never written both read as null, because
      // row level security filters them identically. That is deliberate: this page must
      // not become an oracle for whether an account keeps a sanctuary.
      if (!sanctuary) {
        this.setData({ loading: false, isOwner, sanctuary: null, tributes: [], tributeCountLabel: "", chapter: null, chapterLabels: {} });
        return;
      }
      const [profile, tributes] = await Promise.all([
        isOwner ? getProfile(me) : Promise.resolve(null),
        isOwner || sanctuary.is_public ? listSanctuaryTributes(target) : Promise.resolve([]),
      ]);
      const locale = this.data.locale;
      const chapter = isOwner ? this.chapterFor(profile) : null;
      this.setData({
        loading: false,
        isOwner,
        sanctuary,
        tributes: tributes.map((row) => decorateTribute(row, me, isOwner, locale)),
        tributeCountLabel: countLabel(sanctuary.tribute_count, locale),
        chapter,
        chapterLabels: chapter ? chapterCopy(chapter, locale) : {},
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || t("圣所加载失败，请稍后重试。", this.data.locale) });
    }
  },

  // Chapter arithmetic needs the owner's birth date and target, which only the owner can
  // read. A guest sees the sanctuary without the timeline, by design.
  chapterFor(profile) {
    if (!profile?.birth_date || !(profile.target_date || profile.target_age)) return null;
    const life = calculateLifeMetrics({ birthDate: profile.birth_date, targetAge: profile.target_age, targetDate: profile.target_date });
    if (!Number.isFinite(life.livedDays) || !Number.isFinite(life.totalDays)) return null;
    return calculateChapterMetrics(life.livedDays, life.totalDays);
  },

  async removeTribute(event) {
    const id = event.currentTarget.dataset.id;
    const tribute = this.data.tributes.find((item) => item.id === id);
    if (!tribute || this.data.removing) return;
    this.setData({ removing: true });
    try {
      const answer = await new Promise((resolve) => wx.showModal({
        title: t("删除这条致意？", this.data.locale),
        content: t("删除后无法恢复。", this.data.locale),
        confirmText: t("删除", this.data.locale),
        success: resolve,
        fail: () => resolve({ confirm: false }),
      }));
      if (!answer.confirm) return;
      await deleteSanctuaryTribute(id);
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || t("删除失败，请重试。", this.data.locale), icon: "none" });
    } finally {
      this.setData({ removing: false });
    }
  },

  editSanctuary() { wx.navigateTo({ url: SELF_PATH }); },

  leaveTribute() {
    const session = requireSession();
    if (!session) return;
    const target = this.targetUserId || session.user.id;
    wx.navigateTo({ url: `${TRIBUTE_PATH}?uid=${encodeURIComponent(target)}` });
  },

  // app-share asks for this before it falls back to the shared app card. Only an owner
  // looking at a sanctuary they published themselves may hand out a link, and the link
  // carries the owner's own id. A private sanctuary and every guest view decline, so a
  // private page can never be forwarded from here.
  shareOverride() {
    if (!this.data.isOwner || this.data.sanctuary?.is_public !== true) return null;
    return {
      title: t("看看我为自己留下的字。", this.data.locale),
      path: `${SPACE_PATH}?uid=${this.data.sanctuary.user_id}`,
    };
  },
});
