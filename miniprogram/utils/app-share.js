const t = require('./locale-copy');

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
    return {
      title: t('余生有刻 · 看见余生，认真今天。', locale),
      path: '/pages/index/index',
      imageUrl: '/images/lifescale-icon.png',
    };
  };
  delete definition.onShareTimeline;
  return definition;
};
