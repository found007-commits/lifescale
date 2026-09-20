const t = require('./locale-copy');

// A share path may only carry what a mini program route is allowed to contain. This keeps
// a page from smuggling a scheme, a query it did not mean to publish, or an empty route
// into the card.
const SAFE_PATH = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\?[A-Za-z0-9_=&%.-]*)?$/;

module.exports = function withAppShare(definition) {
  const show = definition.onShow;
  definition.onShow = function(...args) {
    // Only share the app to friends. Never share the current private page or screenshot.
    wx.hideShareMenu({ menus: ['shareTimeline'], fail() {} });
    wx.showShareMenu({ menus: ['shareAppMessage'], fail() {} });
    return show?.apply(this, args);
  };
  definition.onShareAppMessage = function() {
    const locale = getApp().globalData.locale || 'zh';
    // The default card is the app itself and nothing else. A page may redirect it only by
    // returning an explicit, route-shaped { title, path } from shareOverride, and it has to
    // prove that on every call: a falsy return, a private row or a guest view falls through
    // to the app card, so a private page can never be forwarded from any screen.
    const override = typeof definition.shareOverride === 'function' ? definition.shareOverride.call(this) : null;
    const redirected = override && typeof override.path === 'string' && SAFE_PATH.test(override.path) ? override : null;
    // The title goes through the dictionary as well, so a page can hand over a key and let
    // the wrapper localize it. A translated string is returned unchanged.
    const redirectedTitle = redirected && typeof redirected.title === 'string' ? t(redirected.title, locale) : '';
    return {
      title: redirectedTitle || t('余生有刻 · 看见余生，认真今天。', locale),
      path: redirected ? redirected.path : '/pages/index/index',
      imageUrl: '/images/lifescale-icon.png',
    };
  };
  delete definition.onShareTimeline;
  return definition;
};
