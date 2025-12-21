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

  endClaimDevice: async (pin: string) => {
    return await postRequest("device/claim/end", {pin});
  },

  cancelPairing: async () => {
    return await postRequest("device/pairing/cancel", {});
  },

  getDeviceStatus: async (id: string) => {
    return await getRequest("device/status", { id });
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

  unlinkDevice: async (id: string) => {
    return await postRequest("device/unlink", { id });
  },

  updateDevice: async (payload: {
    id: string;
    name?: string;
    schedule?: { mode?: string; intervalMinutes?: number; timesOfDay?: string[] };
    albumId?: string | null;
  }) => {
    return await postRequest("device/update", payload);
  },
};
