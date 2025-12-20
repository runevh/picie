import { Photo } from "../types/Photos";

export function getApiBase() {
    const base = import.meta.env.VITE_API_URL || '';
    return base.endsWith('/') ? base : `${base}/`;
}

export function getUrlFromPhoto(photo: Photo) {
    if (photo.previewData) return photo.previewData;
    if (photo.url) return photo.url;
    return `${getApiBase()}api/photo/get/${photo.id}.png`;
}
