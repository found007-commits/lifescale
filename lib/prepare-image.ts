"use client";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.bmp,.heic,.heif";
export const OPTIMIZED_IMAGE_BYTES = 5 * 1024 * 1024;
export const LARGE_IMAGE_BYTES = 10 * 1024 * 1024;

/** Decode locally, normalize orientation/metadata and produce a portable static JPEG.
 * The original file is never changed or sent to a conversion service.
 * No source-file byte cap: the stored, optimized copy must fit the storage limit.
 */
export async function prepareImage(file: File, en = false): Promise<File> {
  if (!/\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|gif|avif|bmp|heic|heif)$/.test(file.type)) {
    throw new Error(en ? "Choose a JPG, PNG, WebP, GIF, AVIF, BMP or device-supported HEIC photo." : "请选择 JPG、PNG、WebP、GIF、AVIF、BMP 或当前设备支持的 HEIC 图片。");
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(en ? `Cannot read ${file.name}. Try exporting it as JPG or PNG on your device.` : `无法读取「${file.name}」，请在设备上转存为 JPG 或 PNG 后重试。`));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error(en ? "Image processing is unavailable on this device." : "当前设备暂时无法处理图片，请换用较小的图片重试。");
    let edge = Math.min(2560, Math.max(image.naturalWidth, image.naturalHeight));
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .88 - attempt * .06));
        if (blob?.size && blob.size <= OPTIMIZED_IMAGE_BYTES) return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg" });
        edge = Math.round(edge * .7);
      }
      throw new Error(en ? "This image is too complex for your device. Try a smaller export." : "这张图片处理后仍过大，请在设备上缩小后重试。");
    } finally { canvas.width = canvas.height = 1; }
  } finally { URL.revokeObjectURL(url); image.src = ""; }
}
