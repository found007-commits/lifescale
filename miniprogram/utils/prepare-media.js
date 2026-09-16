const { prepareImage } = require("./prepare-image");
const { assertMediaSize } = require("./media-policy");
const { uuid } = require("./life");
function call(name, options) { return new Promise((resolve, reject) => wx[name]({ ...options, success: resolve, fail: reject })); }
function fsCall(name, options) { return new Promise((resolve, reject) => wx.getFileSystemManager()[name]({ ...options, success: resolve, fail: reject })); }

async function prepareMedia(canvas, file) {
  const path = file.tempFilePath || file.path;
  const header = await fsCall("readFile", { filePath: path, position: 0, length: 12 });
  const bytes = new Uint8Array(header.data);
  const magic = Array.from(bytes).map(n => String.fromCharCode(n)).join("");
  const gif = magic.startsWith("GIF87a") || magic.startsWith("GIF89a");
  const video = file.fileType === "video" || /\.(mp4|mov|m4v)$/i.test(file.name || path);
  if (!gif && !video) return prepareImage(canvas, { ...file, tempFilePath: path });
  let source = path, compressed = "";
  try {
    if (video) {
      if (magic.slice(4, 8) !== "ftyp") throw new Error("请选择 MP4 或 MOV 视频；其他格式请先转为 MP4。");
      try {
        const result = await call("compressVideo", { src: path, quality: "medium" });
        source = result.tempFilePath;
        if (source !== path) compressed = source;
      } catch { /* A supported original can still upload within the storage limit. */ }
    }
    const stat = await fsCall("stat", { path: source });
    assertMediaSize(stat.stats.size);
    const ext = gif ? "gif" : (source === path && /\bqt\s/.test(magic) ? "mov" : "mp4");
    const tempFilePath = `${wx.env.USER_DATA_PATH}/lifescale-media-${uuid()}.${ext}`;
    await fsCall("copyFile", { srcPath: source, destPath: tempFilePath });
    return { tempFilePath, size: stat.stats.size, mediaType: gif ? "image/gif" : ext === "mov" ? "video/quicktime" : "video/mp4", kind: gif ? "gif" : "video" };
  } finally { if (compressed) wx.getFileSystemManager().unlink({ filePath: compressed, fail() {} }); }
}
module.exports = { prepareMedia };
