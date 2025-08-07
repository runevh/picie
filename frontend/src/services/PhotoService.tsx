import { AlbumReqData, PhotoReqData } from "../contexts/PhotoContext";
import { getRequest, postRequest } from "./api"; // Adjust path as needed

export const photoService = {
  uploadPhoto: async (data: PhotoReqData) => {
    return await postRequest("photo/upload", data);
  },

  saveAlbum: async (collage: AlbumReqData) => {
    return await postRequest("photo/albums/save", collage);
  },

  createAlbum: async () => {
    return await postRequest("photo/albums/create", {});
  },

  getAlbums: async () => {
    return await getRequest("photo/albums/get", {});
  }
};