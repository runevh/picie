import { Photo } from "../types/Photos";

export function getUrlFromPhoto(photo: Photo) {
    return import.meta.env.VITE_API_URL + "api/photo/get/" + photo.id + ".png";
}