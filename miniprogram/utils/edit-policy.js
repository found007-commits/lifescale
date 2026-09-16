const EDIT_NOTICE = "人生无法重来，记录可以斟酌一次。每条记录仅可修改一次，保存后将不能再次编辑；之后仍可留言，写下新的想法。";
const EDIT_USED = "这条记录已修改过一次，不能再次编辑。你仍可以留言，写下新的想法。";
function canEdit(entry) { return !!entry && Number(entry.edit_count || 0) < 1; }
function editChanged(entry, values) {
  return String(values.content || "").trim() !== String(entry.content || "").trim() || values.mood !== entry.mood || values.category !== entry.category;
}
function editError(error) {
  const message = String(error?.message || "");
  if (message.includes("ENTRY_EDIT_ALREADY_USED")) return EDIT_USED;
  if (message.includes("ENTRY_CONTENT_REQUIRED")) return "请保留文字或至少一个媒体文件。";
  if (message.includes("ENTRY_NOT_FOUND")) return "这条记录不存在或已删除。";
  return "暂时无法确认是否保存成功。请重试同一次修改，或重新打开记录查看；不要重复新建记录。";
}
module.exports = { EDIT_NOTICE, EDIT_USED, canEdit, editChanged, editError };
