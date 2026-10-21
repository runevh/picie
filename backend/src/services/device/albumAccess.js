const { Album, Photo } = require('../../models/photo');
const { UserDeviceRole } = require('../../models/userDeviceRole');

// Albums are private: a frame may display only its current owner's albums.
const getDeviceAlbum = async (deviceId, albumId, userId) => {
  if (!albumId) return null;
  const owner = await UserDeviceRole.findOne({ where: { deviceId, role: 'OWNER' } });
  if (!owner || (userId !== undefined && owner.userId !== userId)) return null;
  return Album.findOne({ where: { id: albumId, owner: owner.userId } });
};

const getDevicePhoto = async (state, photoId) => {
  if (!photoId) return null;
  const album = await getDeviceAlbum(state.deviceId, state.albumId);
  if (!album) return null;
  return Photo.findOne({ where: { id: photoId, albumId: album.id, owner: album.owner } });
};

const getAlbumView = async (state, userId) => {
  const album = state && await getDeviceAlbum(state.deviceId, state.albumId, userId);
  return {
    albumId: album?.id || null,
    album: album ? { id: album.id, name: album.name } : null,
    currentPhotoId: album && await getDevicePhoto(state, state.currentPhotoId) ? state.currentPhotoId : null,
    nextPhotoId: album && await getDevicePhoto(state, state.nextPhotoId) ? state.nextPhotoId : null,
  };
};

module.exports = { getDeviceAlbum, getDevicePhoto, getAlbumView };
