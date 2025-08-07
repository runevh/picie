import { createContext, useContext, useState, useCallback } from 'react';
import { Modal, Group, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconX, IconPhoto } from '@tabler/icons-react';
import { PhotoEditor } from './PhotoEditor';
import { Album, Photo } from '../../types/Photos';

type PhotoUploaderContextType = {
  openUploader: (album: Album, onAdd: (photo: Photo) => void) => void;
};

const PhotoUploaderContext = createContext<PhotoUploaderContextType | undefined>(undefined);

export function usePhotoUploader() {
  const ctx = useContext(PhotoUploaderContext);
  if (!ctx) throw new Error("usePhotoUploader must be used within PhotoUploaderProvider");
  return ctx;
}

export function PhotoUploaderProvider({ children }: { children: React.ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [addImageCallback, setAddImageCallback] = useState<((photo: Photo) => void) | null>(null);

  const openUploader = useCallback((album: Album, onAdd: (photo: Photo) => void) => {
    setAlbum(album);
    setAddImageCallback(() => onAdd);
    setUploadedImage(null);
    setOpened(true);
  }, []);

  const close = () => {
    setUploadedImage(null);
    setOpened(false);
  }

  const handleImageUpload = (files: File[]) => {
    const reader = new FileReader();
    reader.onload = (event) => setUploadedImage(event.target?.result as string);
    reader.readAsDataURL(files[0]);
  };

  return (
    <PhotoUploaderContext.Provider value={{ openUploader }}>
      {children}

      {uploadedImage && album !== null && addImageCallback ? (
        <PhotoEditor
          album={album}
          addPhoto={(photo) => {
            addImageCallback(photo);
            close();
          }}
          close={close}
          image={uploadedImage}
        />
      ) : (
        <Modal withCloseButton={false} opened={opened} onClose={close} centered size="lg" zIndex={1000}>
          <Text size="xl" fw={300} mb="md">Add Photo</Text>
          <Dropzone
            multiple={false}
            onDrop={handleImageUpload}
            maxSize={10 * 1024 ** 2}
            accept={IMAGE_MIME_TYPE}
          >
            <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept><IconUpload size={52} color="var(--mantine-color-blue-6)" /></Dropzone.Accept>
              <Dropzone.Reject><IconX size={52} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
              <Dropzone.Idle><IconPhoto size={52} color="var(--mantine-color-dimmed)" /></Dropzone.Idle>

              <div>
                <Text size="xl">Drag image here or click to select file</Text>
                <Text size="sm" c="dimmed" mt={7}>Attach 1 file, should not exceed 10MB</Text>
              </div>
            </Group>
          </Dropzone>
        </Modal>
      )}
    </PhotoUploaderContext.Provider>
  );
}
