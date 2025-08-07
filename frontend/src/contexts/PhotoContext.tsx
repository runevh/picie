import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ResponseBody } from "../services/api";
import { photoService } from "../services/PhotoService";
import { Album, Photo } from "../types/Photos";

export interface AlbumReqData {
  id: string | null;
  name: string;
  photos: string[];
}

export interface PhotoReqData {
  data: string;
  albumId: string;
}


interface PhotoContextType {
  albums: Album[];
  uploadPhoto: (data: PhotoReqData) => Promise<ResponseBody>;
  saveAlbum: (collage: Album) => Promise<ResponseBody>;
  createAlbum: () => Promise<ResponseBody>;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export function PhotoProvider({ children }: { children: ReactNode }) {
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    getCollages();
  }, []);

  const uploadPhoto = async (data: PhotoReqData): Promise<ResponseBody> => {
    const res = await photoService.uploadPhoto(data);
    if (res.success) {
      const photo: Photo = { id:res.data.id };
      setAlbums((prevAlbums) =>
        prevAlbums.map((album) =>
          album.id === data.albumId
            ? { ...album, photos: [...album.photos, photo] }
            : album
        )
      );


    } else {
      //TODO: Show error
    }
    return res;
  }

  const saveAlbum = async (collage: Album): Promise<ResponseBody> => {
    const data: AlbumReqData = {
      id: collage.id,
      name: collage.name,
      photos: [], //TODO: Fix
    };

    const res = await photoService.saveAlbum(data);

    if (res.success) {
      setAlbums((prevAlbums) =>
        prevAlbums.map((el) => (el.id === collage.id ? collage : el))
      );
    }

    return res;
  }

  const createAlbum = async (): Promise<ResponseBody> => {
    const res = await photoService.createAlbum();
    if (res.success) {
      const album: Album = { id: res.data.id, name: res.data.name, photos: [], collaborators: [] };
      setAlbums(p => [...p, album]);
    }
    return res;
  }

  const getCollages = async (): Promise<ResponseBody> => {
    const res = await photoService.getAlbums();
    console.log(res.data);
    setAlbums(_p => res.data);
    return res;
  }

  return (
    <PhotoContext.Provider value={{ albums, uploadPhoto, saveAlbum, createAlbum }}>
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhoto() {
  const context = useContext(PhotoContext);
  if (!context) throw new Error("usePhoto must be used within a PhotoProvider");
  return context;
}