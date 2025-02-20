import { getRequest, postRequest } from "./api"; // Adjust path as needed

export const deviceService = {
  createDevice: async () => {
    return await postRequest("device/create", {});
  },

  getAllDevices: async () => {
    return await getRequest("device/all/admin", {});
  },

  getAllUserDevices: async () => {
    return await getRequest("device/all", {});
  },

  startClaimDevice: async (id: string) => {
    return await postRequest("device/claim/start", {id});
  },

  endClaimDevice: async (pin: number) => {
    return await postRequest("device/claim/end", {pin});
  },
};
