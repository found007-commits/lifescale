function call(name, options) { return new Promise((resolve, reject) => wx[name]({ ...options, success: resolve, fail: reject })); }

// Store a portable, metadata-free static JPEG, not an oversized camera original.
async function prepareImage(canvas, file) {
  const info = await call("getImageInfo", { src: file.tempFilePath });
  const photo = canvas.createImage();
  await new Promise((resolve, reject) => {
    photo.onload = resolve; photo.onerror = () => reject(new Error("无法读取这张照片，请在设备上转存为 JPG 或 PNG 后重试。"));
    photo.src = /^(?:https?:|wxfile:|file:|\/)/.test(info.path) ? info.path : `/${info.path}`;
  });
  let edge = Math.min(2560, Math.max(info.width, info.height));
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const ratio = Math.min(1, edge / Math.max(info.width, info.height));
      canvas.width = Math.max(1, Math.round(info.width * ratio)); canvas.height = Math.max(1, Math.round(info.height * ratio));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const result = await call("canvasToTempFilePath", { canvas, x: 0, y: 0, width: canvas.width, height: canvas.height, destWidth: canvas.width, destHeight: canvas.height, fileType: "jpg", quality: .88 - attempt * .06 });
      const stat = await new Promise((resolve, reject) => wx.getFileSystemManager().stat({ path: result.tempFilePath, success: resolve, fail: reject }));
      if (stat.stats.size <= 5 * 1024 * 1024) return { tempFilePath: result.tempFilePath, size: stat.stats.size, mediaType: "image/jpeg" };
      wx.getFileSystemManager().unlink({ filePath: result.tempFilePath, fail() {} });
      edge = Math.round(edge * .7);
    }
    throw new Error("图片处理后仍过大，请在设备上缩小后重试。");
  } finally { canvas.width = canvas.height = 1; }
}
module.exports = { prepareImage };
