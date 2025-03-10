import { useState, useRef } from 'react';
import {
    Center,
    Chip,
    Container,
    Flex,
    Group,
    Modal,
    ScrollArea,
    Slider,
    Text,
    Button
} from '@mantine/core';
import { usePhoto } from '../../contexts/PhotoContext';
import { Photo } from '../../contexts/PhotoContext';

interface PhotoEditorProps {
    id: number,
    image: string;
    close: () => void;
    addImage: (img: Photo) => void;
}

export function PhotoEditor({ id, image, close, addImage }: PhotoEditorProps) {
    const { uploadPhoto } = usePhoto();
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [frameRotation, setFrameRotation] = useState(1);
    const [imageScale, setImageScale] = useState(1);
    const [value, setValue] = useState<string | null>('horizontal');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const setVertical = () => setFrameRotation(1);
    const setHorizontal = () => setFrameRotation(0);

    const addPhoto = async () => {
        const data = await generateImageData(); 
        uploadPhoto({
            id: id,
            data: data as string
        }).then(res => {
            addImage({id: res.data.id});
            close();
        });
    };

    const generateImageData = () => {
        return new Promise((resolve, reject) => {
            if (!image || !canvasRef.current) return reject('No image or canvas reference');
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            const img = new Image();
            img.src = image;

            img.onload = () => {
                canvas.width = frameRotation ? 600 : 488;
                canvas.height = frameRotation ? 488 : 600;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(
                    img,
                    img.width / 2 - imagePosition.x * 2 - (imageScale - 1) * img.width / 2,
                    img.height / 2 - imagePosition.y * 2 - (imageScale - 1) * img.height / 2,
                    img.width * imageScale,
                    img.height * imageScale
                );

                const base64 = canvas.toDataURL('image/png');
                resolve(base64);
            };

            img.onerror = reject;
        });
    };

    return (
        <>
            <Modal radius="lg" size="auto" withCloseButton={false} opened onClose={() => { }} centered>
                <Center>
                    <ScrollArea
                        h={frameRotation ? 244 : 300}
                        w={frameRotation ? 300 : 244}
                        bg="white"
                        onScrollPositionChange={({ x, y }) => setImagePosition({ x, y })}
                    >
                        <div style={{ transform: 'scale(0.5)', display: 'inline-block', transformOrigin: 'center' }}>
                            <img src={image} style={{ transform: `scale(${imageScale})` }} alt="Editable content" />
                        </div>
                    </ScrollArea>
                </Center>

                <Container mt={10} mb={30} w={256}>
                    <Text>Zoom</Text>
                    <Slider
                        min={1}
                        max={200}
                        value={imageScale * 100}
                        onChange={(e) => setImageScale(e / 100)}
                        marks={[
                            { value: 50, label: '50%' },
                            { value: 100, label: '100%' },
                            { value: 150, label: '150%' },
                        ]}
                    />
                </Container>

                <Container>
                    <Center>
                        <Flex mt={10} mb={30} w={224} justify="space-between">
                            <Text>Orientation:</Text>
                            <Chip.Group multiple={false} value={value} onChange={setValue}>
                                <Group>
                                    <Chip value="horizontal" onClick={setVertical}>Horizontal</Chip>
                                    <Chip value="vertical" onClick={setHorizontal}>Vertical</Chip>
                                </Group>
                            </Chip.Group>
                        </Flex>
                    </Center>
                </Container>

                <Group justify="center">
                <Button color="red" onClick={close}>Cancel</Button>
                    <Button color="blue" onClick={addPhoto}>Add</Button>
                </Group>
            </Modal>
            <canvas ref={canvasRef} hidden />
        </>
    );
}