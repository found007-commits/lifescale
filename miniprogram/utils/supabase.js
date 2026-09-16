const config = require("../config");
const { localDateString, uuid } = require("./life");
const { loadRuntimeConfig: ensureConfig } = require("./runtime-config");
const { mediaKind, assertMediaSize } = require("./media-policy");
const freshness = require("./data-freshness");

const SESSION_KEY = "lifescale:miniprogram-session";
let refreshInFlight = null;
// Short-lived URLs in memory only; every network read is still checked by RLS.
const listMediaUrls = new Map();
// A cold start reads this key once per request; keep one in-memory copy so the stored
// JSON is parsed once instead of once per call.
let sessionMemo = null;
let sessionMemoReady = false;

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

function restoreSession() {
  if (sessionMemoReady) return sessionMemo;
  sessionMemoReady = true;
  try {
    sessionMemo = wx.getStorageSync(SESSION_KEY) || null;
  } catch {
    sessionMemo = null;
  }
  return sessionMemo;
}

function storeSession(session) {
  if (restoreSession()?.user?.id !== session.user?.id) invalidatePages();
  wx.setStorageSync(SESSION_KEY, session);
  sessionMemo = session;
  sessionMemoReady = true;
  const app = getApp();
  if (app?.globalData) {
    if (app.globalData.session?.user?.id !== session.user?.id) app.globalData.profile = null;
    app.globalData.session = session;
  }
  return session;
}

function clearSession() {
  invalidatePages();
  listMediaUrls.clear();
  sessionMemo = null;
  sessionMemoReady = true;
  wx.removeStorageSync(SESSION_KEY);
  wx.removeStorageSync("lifescale:miniprogram-draft");
  const app = getApp();
  if (app?.globalData) {
    app.globalData.session = null;
    app.globalData.profile = null;
  }
}

function invalidatePages() {
  freshness.state.revision += 1;
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
    ...(options.data !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.header || {}),
  };

  try {
    const result = await wxRequest({
      url: `${service.supabaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data,
      header,
      includeResponse: options.includeResponse,
    });
    if (path.startsWith("/rest/v1/") && !["GET", "HEAD"].includes(options.method || "GET")) invalidatePages();
    return result;
  } catch (error) {
    if (retry && session?.refresh_token && (error.status === 401 || /jwt|token|expired/i.test(error.message))) {
      session = await refreshSession(session);
      return request(path, { ...options, header: { ...(options.header || {}), Authorization: `Bearer ${session.access_token}` } }, false);
    }
    throw error;
  }
}

async function sendOtp(email, createUser = true) {
  const service = await ensureConfig();
  return wxRequest({
    url: `${service.supabaseUrl}/auth/v1/otp`,
    method: "POST",
    header: { apikey: service.publishableKey, "Content-Type": "application/json" },
    data: { email: email.trim().toLowerCase(), create_user: createUser },
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
  if (restoreSession()?.user?.id === userId) getApp().globalData.profile = profile;
  return profile;
}

async function updateProfile(userId, changes) {
  const allowed = ["display_name", "gender_identity", "locale", "timezone", "display_mode", "target_age", "target_date"];
  const data = {};
  allowed.forEach((key) => { if (Object.prototype.hasOwnProperty.call(changes, key)) data[key] = changes[key]; });
  const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", header: { Prefer: "return=representation" }, data });
  if (!rows[0]) throw new Error("资料保存失败，请重新登录。");
  if (restoreSession()?.user?.id === userId) getApp().globalData.profile = rows[0];
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

async function signEntryMedia(item) {
  if (!item?.storage_path) throw new Error("照片地址暂不可用，请重试。");
  const service = await ensureConfig();
  const path = item.storage_path.split("/").map(encodeURIComponent).join("/");
  const signed = await request(`/storage/v1/object/sign/entry-media/${path}`, { method: "POST", data: { expiresIn: 3600 } });
  return { ...item, signed_url: resolveMediaUrl(signed.signedURL || signed.signedUrl, service.supabaseUrl) };
}

function resolveMediaUrl(value, supabaseUrl) {
  const base = supabaseUrl.replace(/\/$/, "");
  let url = "";
  if (typeof value === "string") {
    if (value.startsWith("/object/sign/entry-media/")) url = `${base}/storage/v1${value}`;
    else if (value.startsWith("/storage/v1/object/sign/entry-media/")) url = `${base}${value}`;
    else if (value.startsWith(`${base}/storage/v1/object/sign/entry-media/`)) url = value;
  }
  if (!url) throw new Error("照片地址暂不可用，请重试。");
  return url;
}

async function getEntries(userId, limit = 100, offset = 0, { includeMedia = true } = {}) {
  const select = includeMedia ? "*,entry_media(*)" : "id,entry_date,mood,category";
  const rows = await request(`/rest/v1/life_entries?user_id=eq.${encodeURIComponent(userId)}&select=${select}&order=entry_date.desc,id.desc&limit=${limit}&offset=${offset}`);
  if (!includeMedia) return rows;
  const paths = [...new Set(rows.flatMap(entry => (entry.entry_media || []).filter(item => mediaKind(item) === "image").map(item => item.storage_path)).filter(Boolean))];
  const urls = new Map();
  const service = await ensureConfig();
  const scope = `${service.supabaseUrl}|${userId}|`;
  const missing = paths.filter(path => {
    const cached = listMediaUrls.get(scope + path);
    if (cached && cached.until > Date.now()) { urls.set(path, cached.url); return false; }
    listMediaUrls.delete(scope + path); return true;
  });
  // One batch replaces one request per photo. Videos/GIFs remain on demand.
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100);
    try {
      const signed = await request("/storage/v1/object/sign/entry-media", { method: "POST", data: { paths: batch, expiresIn: 3600 } });
      for (const item of signed) {
        if (!batch.includes(item.path) || item.error) continue;
        try {
          const url = resolveMediaUrl(item.signedURL || item.signedUrl, service.supabaseUrl);
          urls.set(item.path, url);
          if (listMediaUrls.size >= 256) listMediaUrls.delete(listMediaUrls.keys().next().value);
          listMediaUrls.set(scope + item.path, { url, until: Date.now() + 3000000 });
        } catch {}
      }
    } catch { /* Preserve all attachments for retry even when signing fails. */ }
  }
  return rows.map(entry => ({ ...entry, entry_media: (entry.entry_media || []).slice().sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(item => ({ ...item, signed_url: urls.get(item.storage_path) || "" })) }));
}

async function getCheckins(userId, limit = 100) {
  return request(`/rest/v1/checkins?user_id=eq.${encodeURIComponent(userId)}&select=*&order=checkin_date.desc&limit=${limit}`);
}

async function getEntry(entryId, userId) {
  const rows = await request(`/rest/v1/life_entries?id=eq.${encodeURIComponent(entryId)}&user_id=eq.${encodeURIComponent(userId)}&select=*,entry_media(*)`);
  if (!rows[0]) throw new Error("这条记录不存在或已删除。");
  return rows[0];
}
async function editEntryOnce(entryId, values, requestId) {
  const rows = await request("/rest/v1/rpc/edit_private_entry_once", { method: "POST", data: {
    p_entry_id: entryId, p_content: String(values.content || "").trim(),
    p_mood: values.mood, p_category: values.category, p_request_id: requestId,
  } });
  if (!rows[0]) throw new Error("ENTRY_NOT_FOUND");
  return rows[0];
}
async function getComments(entryId, offset = 0) {
  return request(`/rest/v1/entry_comments?entry_id=eq.${encodeURIComponent(entryId)}&select=*&order=created_at.asc,id.asc&limit=30&offset=${offset}`);
}
async function addComment(entryId, content, parentId = null, id = uuid()) {
  const session = restoreSession();
  if (!session?.user?.id) throw new Error("请先登录。");
  const text = String(content || "").trim();
  if (!text || text.length > 2000) throw new Error("留言请填写 1–2000 个字。");
  try {
    return await request("/rest/v1/entry_comments", { method: "POST", header: { Prefer: "return=representation" },
      data: { id, entry_id: entryId, user_id: session.user.id, parent_id: parentId, content: text } });
  } catch (error) {
    if (error.status !== 409) throw error;
    const rows = await request(`/rest/v1/entry_comments?id=eq.${encodeURIComponent(id)}&entry_id=eq.${encodeURIComponent(entryId)}&select=*`);
    if (!rows[0]) throw error;
    return rows;
  }
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
    // A second entry on the same day must not UPDATE a check-in (RLS is insert-only).
    header: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    data: { user_id: userId, checkin_date: localDateString() },
  });
  return rows[0];
}

async function uploadEntryImage(userId, entryId, image, mediaId = uuid()) {
  assertMediaSize(image.size);
  const service = await ensureConfig();
  let session = restoreSession();
  if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) session = await refreshSession(session);
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov" };
  const extension = extensions[image.mediaType];
  if (!extension) throw new Error("不支持这种媒体格式。");
  const storagePath = `${userId}/${entryId}/${mediaId}.${extension}`;
  await new Promise((resolve, reject) => {
    wx.uploadFile({
      timeout: 600000,
      url: `${service.supabaseUrl}/storage/v1/object/entry-media/${storagePath}`,
      filePath: image.tempFilePath,
      name: "file",
      formData: { contentType: image.mediaType },
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
    data: { id: mediaId, entry_id: entryId, user_id: userId, storage_path: storagePath, media_type: image.mediaType },
  }); } catch (error) {
    if (error.status !== 409) throw error;
    const existing = await request(`/rest/v1/entry_media?id=eq.${mediaId}&user_id=eq.${encodeURIComponent(userId)}&select=id`);
    if (!existing[0]) throw error;
  }
}

async function deleteEntry(entry) {
  const session = restoreSession();
  if (!session?.user?.id || !entry?.id || entry.user_id !== session.user.id) {
    throw new Error("请登录原账号后重试。");
  }
  const paths = [...new Set((entry.entry_media || []).map(media => media.storage_path))];
  if (paths.some(path => typeof path !== "string" || !path.startsWith(`${session.user.id}/`) || path.endsWith("/"))) {
    throw new Error("影像信息不完整，请刷新记录后重试。");
  }
  // Match Storage.remove: DELETE the bucket's object endpoint with a JSON body.
  // A bodyless JSON DELETE to an individual object fails in Storage's parser.
  // Remove objects before the row, so a storage failure keeps references for retry.
  for (let offset = 0; offset < paths.length; offset += 100) {
    await request("/storage/v1/object/entry-media", {
      method: "DELETE", data: { prefixes: paths.slice(offset, offset + 100) },
    });
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
    // A private-page deep link must not force authorization before browsing.
    wx.reLaunch({ url: "/pages/index/index" });
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
  getEntry,
  editEntryOnce,
  getComments,
  addComment,
  signEntryMedia,
  getProfile,
  requireSession,
  restoreSession,
  refreshSession,
  storeSession,
  sendOtp,
  verifyOtp,
  updateProfile,
  uploadEntryImage,
};
