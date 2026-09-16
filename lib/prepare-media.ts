"use client";
import { IMAGE_ACCEPT, prepareImage } from "./prepare-image";
export const MEDIA_ACCEPT = `${IMAGE_ACCEPT},video/mp4,video/quicktime,.mp4,.mov,.m4v`;
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export async function prepareMedia(file: File, en = false): Promise<File> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const magic = Array.from(header).map(n => String.fromCharCode(n)).join("");
  const gif = magic.startsWith("GIF87a") || magic.startsWith("GIF89a");
  const video = file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(file.name);
  if (!gif && !video) return prepareImage(file, en);
  if (!file.size || file.size > MAX_MEDIA_BYTES) throw new Error(en ? "This file exceeds the current 50 MB upload limit. Compress it and retry; videos are never trimmed." : "此文件超过当前 50 MB 上传上限，请压缩后再试；不会截短视频。");
  if (video && magic.slice(4, 8) !== "ftyp") throw new Error(en ? "Choose an MP4 or MOV video." : "请选择 MP4 或 MOV 视频；其他格式请先转为 MP4。");
  const mov = video && /\bqt\s/.test(magic);
  return new File([file], `media.${gif ? "gif" : mov ? "mov" : "mp4"}`, { type: gif ? "image/gif" : mov ? "video/quicktime" : "video/mp4" });
}
