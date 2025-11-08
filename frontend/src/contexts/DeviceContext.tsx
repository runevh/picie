import { createContext, ReactNode, useContext, useState } from "react";
import { User } from "./UserContext";
import { ResponseBody } from "../services/api";
import { deviceService } from "../services/DeviceService";

interface Device {
    id: string,
    lastSeen: Date | null,
    owner: User | null
}

interface DeviceContextType {
    devices: Device[];
    createDevice: () => Promise<ResponseBody>;
    getAllDevices: () => Promise<ResponseBody>;
    getAllUserDevices: () => Promise<ResponseBody>;
    startPairing: (id: string) => Promise<ResponseBody>;
    endClaimDevice: (pin: number) => Promise<ResponseBody>;
    deleteDevice: (id: string) => Promise<ResponseBody>;
    rebootDevice: (id: string) => Promise<ResponseBody>;
    fetchDeviceLogs: (id: string) => Promise<ResponseBody>;
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

    const endClaimDevice = async (pin: number): Promise<ResponseBody> => {
        return await deviceService.endClaimDevice(pin);
    }

    const deleteDevice = async (id: string): Promise<ResponseBody> => {
        return await deviceService.deleteDevice(id);
    }

    const rebootDevice = async (id: string): Promise<ResponseBody> => {
        return await deviceService.rebootDevice(id);
    }

    const fetchDeviceLogs = async (id: string): Promise<ResponseBody> => {
        return await deviceService.getDeviceLogs(id);
    }

    return (
        <DeviceContext.Provider value={{ devices, createDevice, getAllDevices, getAllUserDevices, startPairing, endClaimDevice, deleteDevice, rebootDevice, fetchDeviceLogs }}>
            {children}
        </DeviceContext.Provider>
    );
}   

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("useDeviceContext must be used within a DeviceContext");
  return context;
}
