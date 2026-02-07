import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { ResponseBody } from "../services/api";
import { photoService } from "../services/PhotoService";
import { Album, Photo } from "../types/Photos";
import { getApiBase } from "../util/UrlUtil";

const normalizeAlbumsResponse = (data: unknown): Album[] => {
  if (Array.isArray(data)) return data as Album[];
  if (data && typeof data === "object") {
    const albumsList = (data as { albums?: unknown }).albums;
    if (Array.isArray(albumsList)) {
      return albumsList as Album[];
    }
  }
  return [];
};

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
  deleteAlbum: (albumId: string) => Promise<ResponseBody>;
  deletePhotos: (photoIds: string[]) => Promise<ResponseBody>;
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
      const photoId = res.data.id;
      const photo: Photo = {
        id: photoId,
        url: `${getApiBase()}photo/get/${photoId}.png`,
      };
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

  const deleteAlbum = async (albumId: string): Promise<ResponseBody> => {
    const res = await photoService.deleteAlbum(albumId);
    if (res.success) {
      setAlbums((prev) => prev.filter((album) => album.id !== albumId));
    }
    return res;
  };

  const deletePhotos = async (photoIds: string[]): Promise<ResponseBody> => {
    const res = await photoService.deletePhotos(photoIds);
    if (res.success) {
      setAlbums((prev) =>
        prev.map((album) => ({
          ...album,
          photos: album.photos.filter((p) => !photoIds.includes(p.id)),
        }))
      );
    }
    return res;
  };

  const getCollages = async (): Promise<ResponseBody> => {
    const res = await photoService.getAlbums();
    const albumData = normalizeAlbumsResponse(res.data);
    setAlbums(() => albumData);
    return res;
  }

  return (
    <PhotoContext.Provider value={{ albums, uploadPhoto, saveAlbum, createAlbum, deleteAlbum, deletePhotos }}>
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhoto() {
  const context = useContext(PhotoContext);
  if (!context) throw new Error("usePhoto must be used within a PhotoProvider");
  return context;
}
