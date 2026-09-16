// No private data is persisted here. A revision invalidates page-held data after
// successful writes or logout. Other-device changes are fetched within 30 seconds.
const state = { revision: 0 };
function stamp(userId) {
  return { userId, revision: state.revision, at: Date.now(), day: new Date().toDateString() };
}
function reusable(previous, userId) {
  return !!previous && previous.userId === userId && previous.revision === state.revision &&
    Date.now() >= previous.at && Date.now() - previous.at < 30000 && previous.day === new Date().toDateString();
}
module.exports = { state, stamp, reusable };
