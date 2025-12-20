import { createContext, useContext, useState, useCallback } from 'react';
import { Modal, Group, Text, Loader, Stack } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconX, IconPhoto } from '@tabler/icons-react';
import { PhotoEditor } from './PhotoEditor';
import { Album, Photo } from '../../types/Photos';
import heic2any from 'heic2any';

const UPLOADER_MODAL_Z_INDEX = 2400;

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
  const [uploading, setUploading] = useState(false);

  const openUploader = useCallback((album: Album, onAdd: (photo: Photo) => void) => {
    setAlbum(album);
    setAddImageCallback(() => onAdd);
    setUploadedImage(null);
    setOpened(true);
    setUploading(false);
  }, []);

  const close = () => {
    setUploadedImage(null);
    setOpened(false);
  }

  const handleImageUpload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    if (!files.length) return;
    const file = files[0];

    const isHeic =
      file.type.toLowerCase().includes('heic') ||
      file.type.toLowerCase().includes('heif') ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif');

    let source: Blob | File = file;

    if (isHeic) {
      try {
        const converted = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 0.92,
        });
        source = Array.isArray(converted) ? converted[0] : (converted as Blob);
      } catch (error) {
        console.error('HEIC conversion failed', error);
        setUploading(false);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setUploading(false);
    };
    reader.onerror = () => {
      setUploading(false);
    };
    reader.readAsDataURL(source);
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
        <Modal
          withCloseButton={false}
          opened={opened}
          onClose={close}
          centered
          size="lg"
          zIndex={UPLOADER_MODAL_Z_INDEX}
          overlayProps={{ opacity: 0.55, blur: 4 }}
        >
          <Text size="xl" fw={300} mb="md">Add Photo</Text>
          <Dropzone
            multiple={false}
            onDrop={handleImageUpload}
            maxSize={10 * 1024 ** 2}
            accept={[...IMAGE_MIME_TYPE, 'image/heic', 'image/heif']}
            disabled={uploading}
          >
            <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
              <Dropzone.Accept><IconUpload size={52} color="var(--mantine-color-blue-6)" /></Dropzone.Accept>
              <Dropzone.Reject><IconX size={52} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
              <Dropzone.Idle><IconPhoto size={52} color="var(--mantine-color-dimmed)" /></Dropzone.Idle>

              <Stack gap={4} align="center">
                <Text size="xl">Drag image here or click to select file</Text>
                <Text size="sm" c="dimmed" mt={7}>Attach 1 file, should not exceed 10MB</Text>
                {uploading && (
                  <Group gap={6} mt="xs" justify="center">
                    <Loader size="sm" />
                    <Text size="sm" c="dimmed">Preparing your photo...</Text>
                  </Group>
                )}
              </Stack>
            </Group>
          </Dropzone>
        </Modal>
      )}
    </PhotoUploaderContext.Provider>
  );
}
