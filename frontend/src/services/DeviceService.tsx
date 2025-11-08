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

  startPairing: async (id: string) => {
    return await postRequest("device/pairing/start", {id});
  },

  endClaimDevice: async (pin: number) => {
    return await postRequest("device/claim/end", {pin});
  },

  deleteDevice: async (id: string) => {
    return await postRequest("device/delete", { id });
  },

  rebootDevice: async (id: string) => {
    return await postRequest("device/reboot", { id });
  },

  getDeviceLogs: async (id: string) => {
    return await postRequest("device/logs", { id });
  },
};
