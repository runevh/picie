import { createContext, ReactNode, useContext, useState } from "react";
import { User } from "./UserContext";
import { ResponseBody } from "../services/api";
import { deviceService, PairingSession } from "../services/DeviceService";

interface Device {
    id: string,
    uuid?: string,
    lastSeen: Date | string | null,
    isOnline?: boolean,
    owner?: User | null
}

interface DeviceContextType {
    devices: Device[];
    createDevice: () => Promise<ResponseBody>;
    getAllDevices: () => Promise<ResponseBody>;
    getAllUserDevices: () => Promise<ResponseBody>;
    startPairing: (id: string) => Promise<ResponseBody>;
    endClaimDevice: (pin: string, session: PairingSession) => Promise<ResponseBody>;
    cancelPairing: (session: PairingSession) => Promise<ResponseBody>;
    getDeviceStatus: (id: string) => Promise<ResponseBody>;
    deleteDevice: (id: string) => Promise<ResponseBody>;
    unlinkDevice: (id: string) => Promise<ResponseBody>;
    rebootDevice: (id: string) => Promise<ResponseBody>;
    fetchDeviceLogs: (id: string) => Promise<ResponseBody>;
    uploadFirmware: (data: { id: string; filename?: string; data: string }) => Promise<ResponseBody>;
    updateDevice: (data: {
      id: string;
      name?: string;
      schedule?: { mode?: string; intervalMinutes?: number; timesOfDay?: string[]; timeZone?: string };
      albumId?: string | null;
    }) => Promise<ResponseBody>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
    const [devices, setDevices] = useState([]);

    const createDevice = async (): Promise<ResponseBody> => {
        return await deviceService.createDevice();
    }

    const getAllDevices = async (): Promise<ResponseBody> => {
        return await deviceService.getAllDevices();
    }

    const getAllUserDevices = async (): Promise<ResponseBody> => {
        return await deviceService.getAllUserDevices();
    }

    const startPairing = deviceService.startPairing;
    const endClaimDevice = deviceService.endClaimDevice;
    const cancelPairing = deviceService.cancelPairing;

    const getDeviceStatus = async (id: string): Promise<ResponseBody> => {
        return await deviceService.getDeviceStatus(id);
    }

    const deleteDevice = async (id: string): Promise<ResponseBody> => {
        return await deviceService.deleteDevice(id);
    }

    const unlinkDevice = async (id: string): Promise<ResponseBody> => {
        return await deviceService.unlinkDevice(id);
    }

    const rebootDevice = async (id: string): Promise<ResponseBody> => {
        return await deviceService.rebootDevice(id);
    }

    const fetchDeviceLogs = async (id: string): Promise<ResponseBody> => {
        return await deviceService.getDeviceLogs(id);
    }

    const uploadFirmware = async (data: { id: string; filename?: string; data: string }): Promise<ResponseBody> => {
        return await deviceService.uploadFirmware(data);
    }

    const updateDevice = async (data: {
      id: string;
      name?: string;
      schedule?: { mode?: string; intervalMinutes?: number; timesOfDay?: string[]; timeZone?: string };
      albumId?: string | null;
    }): Promise<ResponseBody> => {
      return await deviceService.updateDevice(data);
    }

    return (
        <DeviceContext.Provider value={{ devices, createDevice, getAllDevices, getAllUserDevices, startPairing, endClaimDevice, cancelPairing, getDeviceStatus, deleteDevice, unlinkDevice, rebootDevice, fetchDeviceLogs, uploadFirmware, updateDevice }}>
            {children}
        </DeviceContext.Provider>
    );
}   

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("useDeviceContext must be used within a DeviceContext");
  return context;
}
