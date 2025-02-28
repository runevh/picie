import { getRequest, postRequest } from "./api"; // Adjust path as needed

export const photoService = {
  uploadPhoto: async (img: Blob) => {
    return await postRequest("photo/upload", img);
  },
};