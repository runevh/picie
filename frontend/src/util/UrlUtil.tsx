import { Photo } from "../types/Photos";

export function getApiBase() {
    const raw = import.meta.env.VITE_API_URL || '';
    const normalized = raw.endsWith('/') ? raw : `${raw}/`;
    if (normalized.endsWith('/api/')) return normalized;
    return `${normalized}api/`;
}

export function getUrlFromPhoto(photo: Photo) {
    if (photo.previewData) return photo.previewData;
    if (photo.url) return photo.url;
    return `${getApiBase()}photo/get/${photo.id}.png`;
}
