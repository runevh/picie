import { CollageReqData, PhotoReqData } from "../contexts/PhotoContext";
import { getRequest, postRequest } from "./api"; // Adjust path as needed

export const photoService = {
  uploadPhoto: async (data: PhotoReqData) => {
    return await postRequest("photo/upload", data);
  },

  saveCollage: async (collage: CollageReqData) => {
    return await postRequest("photo/collage/save", collage);
  },

  createCollage: async () => {
    return await postRequest("photo/collage/create", {});
  },

  getCollages: async () => {
    return await getRequest("photo/collage/get", {});
  }
};