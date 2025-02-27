import { createContext, ReactNode, useContext, useState } from "react";
import { ResponseBody } from "../services/api";
import { photoService } from "../services/PhotoService";

interface Photo {
    img: any
}

interface PhotoContextType {
    uploadPhoto: (img: any) => Promise<ResponseBody>;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);


export function PhotoProvider({ children }: { children: ReactNode }) {

    const uploadPhoto = async (img: Blob): Promise<ResponseBody> => {
        return await photoService.uploadPhoto(img);
    }

    return (
        <PhotoContext.Provider value={{ uploadPhoto }}>
            {children}
        </PhotoContext.Provider>
    );
}

export function usePhoto() {
  const context = useContext(PhotoContext);
  if (!context) throw new Error("usePhoto must be used within a PhotoProvider");
  return context;
}