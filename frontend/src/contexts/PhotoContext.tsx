import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ResponseBody } from "../services/api";
import { photoService } from "../services/PhotoService";

export interface Photo {
    id: number;
}

export interface Collage {
    id: number;
    name: string;
    photos: Photo[];
}

export interface CollageReqData {
    id: number | null;
    name: string;
    photos: number[];
}

export interface PhotoReqData {
    id: number;
    data: string;
}


interface PhotoContextType {
    collages: Collage[];
    uploadPhoto: (data: PhotoReqData) => Promise<ResponseBody>;
    saveCollage: (collage: Collage) => Promise<ResponseBody>;
    createCollage: () => Promise<ResponseBody>;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [collages, setCollages] = useState<Collage[]>([]);

  useEffect(() => {
    getCollages();
  }, []);

  const uploadPhoto = async (data: PhotoReqData): Promise<ResponseBody> => {
    return await photoService.uploadPhoto(data);
  }

  const saveCollage = async (collage: Collage): Promise<ResponseBody> => {
    const data: CollageReqData = {
      id: collage.id,
      name: collage.name,
      photos: collage.photos.map((p) => p.id)
    };

    const res = await photoService.saveCollage(data);

    if (res.success) {
      setCollages((prevCollages) =>
        prevCollages.map((el) => (el.id === collage.id ? collage : el))
      );
    }

    return res;
  }

  const createCollage = async (): Promise<ResponseBody> => {
    const res =  await photoService.createCollage();
    if (res.success) {
      const collage: Collage = {id: res.data.id, name: res.data.name, photos: []};
      setCollages(p => [...p, collage]);
    }
    return res;
  }

  const getCollages = async (): Promise<ResponseBody> => {
    const res = await photoService.getCollages();
    setCollages(_p => res.data);
    return res;
  }

  return (
    <PhotoContext.Provider value={{ uploadPhoto, saveCollage, collages, createCollage }}>
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhoto() {
  const context = useContext(PhotoContext);
  if (!context) throw new Error("usePhoto must be used within a PhotoProvider");
  return context;
}