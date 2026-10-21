const photoUrl = id => `/api/photo/get/${encodeURIComponent(String(id))}.png`;
module.exports = { photoUrl };
