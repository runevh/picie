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

    return (
        <DeviceContext.Provider value={{ devices, createDevice, getAllDevices, getAllUserDevices, startPairing, endClaimDevice }}>
            {children}
        </DeviceContext.Provider>
    );
}   

export function useDeviceContext() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error("useDeviceContext must be used within a DeviceContext");
  return context;
}