const config = require("../config");
const { localDateString, uuid } = require("./life");

const SESSION_KEY = "lifescale:miniprogram-session";
let runtimeConfig = null;
let refreshInFlight = null;

function wxRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      timeout: 20000,
      ...options,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(options.includeResponse ? response : response.data);
        else {
          const error = new Error(response.data?.msg || response.data?.message || response.data?.error_description || response.data?.error || "请求失败，请稍后重试。");
          error.status = response.statusCode;
          reject(error);
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络连接失败。"));
      },
    });
  });
}

async function ensureConfig() {
  if (runtimeConfig) return runtimeConfig;
  const remote = await wxRequest({ url: `${config.apiBase}/api/miniprogram/config`, method: "GET" });
  if (!remote.supabaseUrl || !remote.publishableKey) throw new Error("服务配置暂不可用。" );
  runtimeConfig = remote;
  return runtimeConfig;
}

function restoreSession() {
  try {
    return wx.getStorageSync(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

function storeSession(session) {
  wx.setStorageSync(SESSION_KEY, session);
  const app = getApp();
  if (app?.globalData) app.globalData.session = session;
  return session;
}

function clearSession() {
  wx.removeStorageSync(SESSION_KEY);
  wx.removeStorageSync("lifescale:miniprogram-draft");
  const app = getApp();
  if (app?.globalData) {
    app.globalData.session = null;
    app.globalData.profile = null;
  }
}

async function refreshSession(session) {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefreshSession(session);
  try { return await refreshInFlight; } finally { refreshInFlight = null; }
}

async function doRefreshSession(session) {
  if (!session?.refresh_token) throw new Error("登录已过期，请重新获取验证码。" );
  const service = await ensureConfig();
  const data = await wxRequest({
    url: `${service.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    method: "POST",
    header: { apikey: service.publishableKey, "Content-Type": "application/json" },
    data: { refresh_token: session.refresh_token },
  });
  return storeSession(data);
}

async function request(path, options = {}, retry = true) {
  const service = await ensureConfig();
  let session = restoreSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  const header = {
    apikey: service.publishableKey,
    Authorization: `Bearer ${session?.access_token || service.publishableKey}`,
    "Content-Type": "application/json",
    ...(options.header || {}),
  };

  try {
    return await wxRequest({
      url: `${service.supabaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data,
      header,
      includeResponse: options.includeResponse,
    });
  } catch (error) {
    if (retry && session?.refresh_token && (error.status === 401 || /jwt|token|expired/i.test(error.message))) {
      session = await refreshSession(session);
      return request(path, { ...options, header: { ...(options.header || {}), Authorization: `Bearer ${session.access_token}` } }, false);
    }
    throw error;
  }
}

async function sendOtp(email) {
  const service = await ensureConfig();
  return wxRequest({
    url: `${service.supabaseUrl}/auth/v1/otp`,
    method: "POST",
    header: { apikey: service.publishableKey, "Content-Type": "application/json" },
    data: { email: email.trim().toLowerCase(), create_user: true },
  });
}

async function verifyOtp(email, token) {
  const service = await ensureConfig();
  const session = await wxRequest({
    url: `${service.supabaseUrl}/auth/v1/verify`,
    method: "POST",
    header: { apikey: service.publishableKey, "Content-Type": "application/json" },
    data: { email: email.trim().toLowerCase(), token: token.trim(), type: "email" },
  });
  return storeSession(session);
}

async function getProfile(userId) {
  const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  const profile = rows[0] || null;
  getApp().globalData.profile = profile;
  return profile;
}

async function updateProfile(userId, changes) {
  const allowed = ["display_name", "gender_identity", "locale", "timezone", "display_mode", "target_age", "target_date"];
  const data = {};
  allowed.forEach((key) => { if (Object.prototype.hasOwnProperty.call(changes, key)) data[key] = changes[key]; });
  const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", header: { Prefer: "return=representation" }, data });
  if (!rows[0]) throw new Error("资料保存失败，请重新登录。");
  getApp().globalData.profile = rows[0];
  return rows[0];
}

async function createProfile(profile) {
  const rows = await request("/rest/v1/profiles", {
    method: "POST",
    header: { Prefer: "return=representation" },
    data: profile,
  });
  return rows[0];
}

async function getEntries(userId, limit = 100) {
  const rows = await request(`/rest/v1/life_entries?user_id=eq.${encodeURIComponent(userId)}&select=*,entry_media(*)&order=entry_date.desc&limit=${limit}`);
  return Promise.all(rows.map(async (entry) => {
    const media = await Promise.all((entry.entry_media || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(async (item) => {
      try {
        const signed = await request(`/storage/v1/object/sign/entry-media/${item.storage_path}`, { method: "POST", data: { expiresIn: 3600 } });
        return { ...item, signed_url: `${runtimeConfig.supabaseUrl}/storage/v1${signed.signedURL}` };
      } catch {
        return item;
      }
    }));
    return { ...entry, entry_media: media };
  }));
}

async function getCheckins(userId, limit = 100) {
  return request(`/rest/v1/checkins?user_id=eq.${encodeURIComponent(userId)}&select=*&order=checkin_date.desc&limit=${limit}`);
}

async function getCheckinCount(userId) {
  const response = await request(`/rest/v1/checkins?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`, {
    header: { Prefer: "count=exact" }, includeResponse: true,
  });
  const key = Object.keys(response.header || {}).find((name) => name.toLowerCase() === "content-range");
  const total = key && String(response.header[key]).split("/")[1];
  if (!total || total === "*" || !Number.isFinite(Number(total))) throw new Error("记录天数暂不可用，请重试。");
  return Number(total);
}

async function exportAccount() {
  let session = restoreSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  if (!session?.access_token) throw new Error("请重新登录。");
  return wxRequest({ url: `${config.apiBase}/api/account/export`, method: "GET", header: { Authorization: `Bearer ${session.access_token}` } });
}

async function createEntry({ id, userId, content, mood, category }) {
  const entryId = id || uuid();
  let rows;
  try { rows = await request("/rest/v1/life_entries", {
    method: "POST",
    header: { Prefer: "return=representation" },
    data: { id: entryId, user_id: userId, entry_date: new Date().toISOString(), content, mood, category, visibility: "private" },
  }); } catch (error) {
    if (!id || error.status !== 409) throw error;
    rows = await request(`/rest/v1/life_entries?id=eq.${entryId}&user_id=eq.${encodeURIComponent(userId)}&select=*`);
    if (!rows[0]) throw error;
  }
  await request("/rest/v1/checkins?on_conflict=user_id,checkin_date", {
    method: "POST",
    header: { Prefer: "resolution=merge-duplicates,return=minimal" },
    data: { user_id: userId, checkin_date: localDateString() },
  });
  return rows[0];
}

async function uploadEntryImage(userId, entryId, image, mediaId = uuid()) {
  const service = await ensureConfig();
  let session = restoreSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  const extension = image.mediaType === "image/jpeg" ? "jpg" : (image.tempFilePath.split(".").pop() || "jpg").toLowerCase();
  const mediaTypes = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
  const storagePath = `${userId}/${entryId}/${mediaId}.${extension}`;
  await new Promise((resolve, reject) => {
    wx.uploadFile({
      timeout: 120000,
      url: `${service.supabaseUrl}/storage/v1/object/entry-media/${storagePath}`,
      filePath: image.tempFilePath,
      name: "file",
      header: { apikey: service.publishableKey, Authorization: `Bearer ${session.access_token}`, "x-upsert": "false" },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 || response.statusCode === 409 || /already exists|duplicate/i.test(String(response.data))) resolve(response.data);
        else reject(new Error("照片上传失败。"));
      },
      fail() { reject(new Error("照片上传失败。")); },
    });
  });
  try { await request("/rest/v1/entry_media", {
    method: "POST",
    header: { Prefer: "return=minimal" },
    data: { id: mediaId, entry_id: entryId, user_id: userId, storage_path: storagePath, media_type: mediaTypes[extension] || "image/jpeg" },
  }); } catch (error) {
    if (error.status !== 409) throw error;
    const existing = await request(`/rest/v1/entry_media?id=eq.${mediaId}&user_id=eq.${encodeURIComponent(userId)}&select=id`);
    if (!existing[0]) throw error;
  }
}

async function deleteEntry(entry) {
  for (const media of entry.entry_media || []) {
    await request(`/storage/v1/object/entry-media/${media.storage_path}`, { method: "DELETE" });
  }
  await request(`/rest/v1/life_entries?id=eq.${encodeURIComponent(entry.id)}&user_id=eq.${encodeURIComponent(entry.user_id)}`, { method: "DELETE" });
}

async function deleteAccount() {
  let session = restoreSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  if (!session?.access_token) throw new Error("登录已过期，请重新登录。" );
  return wxRequest({
    url: `${config.apiBase}/api/account/delete`,
    method: "DELETE",
    header: { Authorization: `Bearer ${session.access_token}` },
  });
}

function requireSession() {
  const session = restoreSession();
  if (!session?.user?.id) {
    wx.reLaunch({ url: "/pages/auth/auth" });
    return null;
  }
  return session;
}

module.exports = {
  clearSession,
  createEntry,
  createProfile,
  deleteAccount,
  deleteEntry,
  exportAccount,
  getCheckinCount,
  getCheckins,
  getEntries,
  getProfile,
  requireSession,
  restoreSession,
  sendOtp,
  verifyOtp,
  updateProfile,
  uploadEntryImage,
};
