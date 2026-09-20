const Page = require("../../../../utils/localized-page");
const { getSanctuaryProfile, requireSession, saveSanctuaryProfile } = require("../../../../utils/supabase");
const { tributeCountLabel: countLabel } = require("../../../../utils/sanctuary-copy");
const t = require("../../../../utils/locale-copy");

const SPACE_PATH = "/subpackages/sanctuary/pages/space/space";
const MAX_LENGTH = 200;
const CREED_SLOTS = 3;

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    epitaph: "",
    creeds: ["", "", ""],
    isPublic: false,
    hasRow: false,
    tributeCountLabel: "",
  },

  onShow() { return this.load(); },

  async load() {
    const session = requireSession();
    if (!session) return;
    this.userId = session.user.id;
    this.setData({ loading: true, error: "" });
    try {
      const sanctuary = await getSanctuaryProfile(this.userId);
      this.setData({
        loading: false,
        hasRow: !!sanctuary,
        epitaph: sanctuary?.epitaph || "",
        creeds: [sanctuary?.creed_1 || "", sanctuary?.creed_2 || "", sanctuary?.creed_3 || ""],
        isPublic: sanctuary?.is_public === true,
        tributeCountLabel: sanctuary ? countLabel(sanctuary.tribute_count, this.data.locale) : "",
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || t("圣所加载失败，请稍后重试。", this.data.locale) });
    }
  },

  onEpitaphInput(event) { this.setData({ epitaph: event.detail.value }); },

  onCreedInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= CREED_SLOTS) return;
    const creeds = this.data.creeds.slice();
    creeds[index] = event.detail.value;
    this.setData({ creeds });
  },

  onPublicChange(event) { this.setData({ isPublic: event.detail.value === true }); },

  async save() {
    if (this.data.saving) return;
    const locale = this.data.locale;
    const epitaph = String(this.data.epitaph || "").trim();
    // An empty first line would leave a published sanctuary with nothing at the top.
    if (!epitaph) return this.setData({ error: t("墓志铭是圣所的第一行字，请先写下。", locale) });
    if (epitaph.length > MAX_LENGTH) return this.setData({ error: t("墓志铭请控制在 200 个字以内。", locale) });
    const creeds = this.data.creeds.map((value) => String(value || "").trim());
    if (creeds.some((value) => value.length > MAX_LENGTH)) {
      return this.setData({ error: t("每条信条请控制在 200 个字以内。", locale) });
    }
    this.setData({ saving: true, error: "" });
    try {
      const sanctuary = await saveSanctuaryProfile(this.userId, {
        epitaph,
        creed_1: creeds[0],
        creed_2: creeds[1],
        creed_3: creeds[2],
        is_public: this.data.isPublic === true,
      });
      this.setData({
        saving: false,
        hasRow: true,
        epitaph: sanctuary.epitaph,
        creeds: [sanctuary.creed_1 || "", sanctuary.creed_2 || "", sanctuary.creed_3 || ""],
        isPublic: sanctuary.is_public === true,
        // The counter is server owned, so the value shown after a save is the one the
        // database returned rather than the one the page was holding.
        tributeCountLabel: countLabel(sanctuary.tribute_count, locale),
      });
      wx.showToast({ title: t("已保存", locale), icon: "success" });
      wx.navigateBack({ fail: () => wx.redirectTo({ url: SPACE_PATH }) });
    } catch (error) {
      this.setData({ saving: false, error: error.message || t("保存失败，请重试。", locale) });
    }
  },
});
