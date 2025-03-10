import { useState } from 'react';
import { Modal, Group, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconUpload, IconX, IconPhoto } from '@tabler/icons-react';
import { PhotoEditor } from './PhotoEditor';
import { Photo } from '../../contexts/PhotoContext';

interface PhotoUploaderProps {
    close: () => void;
    addImage: (img: Photo) => void;
    id: number,
}

export function PhotoUploader({ id, close, addImage }: PhotoUploaderProps) {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    const handleImageUpload = (files: File[]) => {
        const reader = new FileReader();
        reader.onload = (event) => setUploadedImage(event.target?.result as string);
        reader.readAsDataURL(files[0]);
    };

    return (
        <>
            {!uploadedImage ? (
                <Modal withCloseButton={false} opened onClose={close} centered size="lg">
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
            ) : (
                <PhotoEditor id={id} addImage={addImage} close={close} image={uploadedImage} />
            )}
        </>
    );
}