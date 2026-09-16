// Shared by upload, list and detail views. Never send a video to an image decoder.
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
function mediaKind(media) {
  const type = media.media_type || media.mediaType || media.type || "";
  if (type.startsWith("video/")) return "video";
  return type === "image/gif" ? "gif" : "image";
}
function assertMediaSize(size) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("文件为空或无法读取，请重新选择。");
  if (size > MAX_MEDIA_BYTES) throw new Error("此文件超过当前 50 MB 上传上限，请压缩后再试；不会截短视频。");
}
function decorateMedia(items = []) {
  return items.map(item => ({ ...item, kind: mediaKind(item) }));
}
module.exports = { MAX_MEDIA_BYTES, mediaKind, assertMediaSize, decorateMedia };
