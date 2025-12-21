import { createContext, ReactNode, useContext, useState } from "react";
import { User } from "./UserContext";
import { ResponseBody } from "../services/api";
import { deviceService } from "../services/DeviceService";

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
    endClaimDevice: (pin: string) => Promise<ResponseBody>;
    cancelPairing: () => Promise<ResponseBody>;
    getDeviceStatus: (id: string) => Promise<ResponseBody>;
    deleteDevice: (id: string) => Promise<ResponseBody>;
    unlinkDevice: (id: string) => Promise<ResponseBody>;
    rebootDevice: (id: string) => Promise<ResponseBody>;
    fetchDeviceLogs: (id: string) => Promise<ResponseBody>;
    updateDevice: (data: {
      id: string;
      name?: string;
      schedule?: { mode?: string; intervalMinutes?: number; timesOfDay?: string[] };
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

    const startPairing = async (id: string): Promise<ResponseBody> => {
        return await deviceService.startPairing(id);
    }

    const endClaimDevice = async (pin: string): Promise<ResponseBody> => {
        return await deviceService.endClaimDevice(pin);
    }

    const cancelPairing = async (): Promise<ResponseBody> => {
        return await deviceService.cancelPairing();
    }

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

    const updateDevice = async (data: {
      id: string;
      name?: string;
      schedule?: { mode?: string; intervalMinutes?: number; timesOfDay?: string[] };
      albumId?: string | null;
    }): Promise<ResponseBody> => {
      return await deviceService.updateDevice(data);
    }

    return (
        <DeviceContext.Provider value={{ devices, createDevice, getAllDevices, getAllUserDevices, startPairing, endClaimDevice, cancelPairing, getDeviceStatus, deleteDevice, unlinkDevice, rebootDevice, fetchDeviceLogs, updateDevice }}>
            {children}
        </DeviceContext.Provider>
    );
}   

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("useDeviceContext must be used within a DeviceContext");
  return context;
}
