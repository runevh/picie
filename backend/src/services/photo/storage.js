const fs = require('fs');
const { directory, photoPath } = require('./paths');
const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const { Photo, Album } = require('../../models/photo');
const { DeviceState } = require('../../models/deviceState');
const PhotoOperation = require('../../models/photoOperation');

const failure = (status, message) => Object.assign(new Error(message), { status });

function removeFile(filename) {
    try { fs.unlinkSync(filename); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

async function recoverOperation(id) {
    return sequelize.transaction(async transaction => {
        const operation = await PhotoOperation.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!operation) return;
        for (const photoId of operation.photoIds) {
            const published = operation.kind === 'upload' && await Photo.findByPk(photoId, { transaction });
            for (const extension of ['png', 'data']) {
                removeFile(photoPath(photoId, `${extension}.pending`));
                if (!published) removeFile(photoPath(photoId, extension));
            }
        }
        await operation.destroy({ transaction });
    });
}

async function recoverPhotoOperations(owner) {
    const operations = await PhotoOperation.findAll({ where: owner === undefined ? {} : { owner }, attributes: ['id'] });
    let failed = false;
    for (const operation of operations) {
        try { await recoverOperation(operation.id); } catch (error) {
            failed = true;
            console.error('Photo cleanup will be retried:', operation.id, error.message);
        }
    }
    if (failed) throw failure(503, 'Photo file cleanup is pending. Please try again.');
}

async function publishPhoto(owner, albumId, image, pixels) {
    const id = randomUUID();
    const operation = await PhotoOperation.create({ owner, kind: 'upload', photoIds: [id] });
    try {
        return await sequelize.transaction(async transaction => {
            // Recovery takes the same lock, so it cannot remove an active upload.
            const pending = await PhotoOperation.findByPk(operation.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!pending) throw failure(409, 'Upload was cancelled. Please try again.');
            const album = await Album.findOne({ where: { id: albumId, owner }, transaction, lock: transaction.LOCK.UPDATE });
            if (!album) throw failure(404, 'Album not found');
            fs.mkdirSync(directory, { recursive: true });
            for (const [extension, bytes] of [['png', image], ['data', pixels]]) {
                fs.writeFileSync(photoPath(id, `${extension}.pending`), bytes, { flag: 'wx' });
            }
            for (const extension of ['png', 'data']) {
                fs.renameSync(photoPath(id, `${extension}.pending`), photoPath(id, extension));
            }
            const photo = await Photo.create({ id, owner, albumId }, { transaction });
            await pending.destroy({ transaction });
            return photo;
        });
    } catch (error) {
        try { await recoverOperation(operation.id); } catch (cleanupError) {
            console.error('Upload cleanup will be retried:', operation.id, cleanupError.message);
        }
        throw error;
    }
}

async function removePhotos(owner, ids, albumId) {
    await recoverPhotoOperations(owner);
    const { photoIds, operationId } = await sequelize.transaction(async transaction => {
        const album = albumId && await Album.findOne({ where: { id: albumId, owner }, transaction, lock: transaction.LOCK.UPDATE });
        if (albumId && !album) throw failure(404, 'Album not found');
        const photos = await Photo.findAll({
            where: albumId ? { albumId, owner } : { id: ids, owner }, transaction, lock: transaction.LOCK.UPDATE,
        });
        const photoIds = photos.map(photo => photo.id);
        const operation = photoIds.length && await PhotoOperation.create({ owner, kind: 'delete', photoIds }, { transaction });
        if (photoIds.length) {
            await DeviceState.update({ currentPhotoId: null }, { where: { currentPhotoId: { [Op.in]: photoIds } }, transaction });
            await DeviceState.update({ nextPhotoId: null, nextUpdateAt: new Date() }, { where: { nextPhotoId: { [Op.in]: photoIds } }, transaction });
            await Photo.destroy({ where: { id: photoIds, owner }, transaction });
        }
        if (album) {
            await DeviceState.update({ albumId: null, currentPhotoId: null, nextPhotoId: null, nextUpdateAt: null }, { where: { albumId }, transaction });
            await album.destroy({ transaction });
        }
        return { photoIds, operationId: operation && operation.id };
    });
    if (operationId) {
        try { await recoverOperation(operationId); } catch (error) {
            throw failure(503, 'Removed from your library, but file cleanup is pending and will be retried.');
        }
    }
    return photoIds;
}

module.exports = { photoPath, publishPhoto, removePhotos, recoverPhotoOperations };
