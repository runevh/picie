import { useState, useRef, useEffect } from 'react';
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
    Button,
    Loader
} from '@mantine/core';
import { usePhoto } from '../../contexts/PhotoContext';
import { Album, Photo } from '../../types/Photos';

interface PhotoEditorProps {
    album: Album,
    image: string;
    close: () => void;
    addPhoto: (photo: Photo) => void;
}

export function PhotoEditor({ album, image, close, addPhoto }: PhotoEditorProps) {
    const { uploadPhoto } = usePhoto();
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [frameRotation, setFrameRotation] = useState(1);
    const [imageScale, setImageScale] = useState(1);
    const [value, setValue] = useState<string | null>('horizontal');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);


    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const scrollStart = useRef({ left: 0, top: 0 });


    const setVertical = () => setFrameRotation(1);
    const setHorizontal = () => setFrameRotation(0);

    useEffect(() => {
        const viewport = scrollViewportRef.current;
        if (!viewport) return;

        // Center scroll initially
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
        viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;

        const handleMouseDown = (e: MouseEvent) => {
            isDragging.current = true;
            dragStart.current = { x: e.clientX, y: e.clientY };
            scrollStart.current = {
                left: viewport.scrollLeft,
                top: viewport.scrollTop,
            };
            viewport.style.cursor = 'grabbing';
            viewport.style.userSelect = 'none';
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;

            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;

            const newLeft = scrollStart.current.left - dx;
            const newTop = scrollStart.current.top - dy;

            // Clamp to prevent negative scroll
            viewport.scrollLeft = Math.max(0, newLeft);
            viewport.scrollTop = Math.max(0, newTop);
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            viewport.style.cursor = 'grab';
            viewport.style.removeProperty('user-select');
        };

        // Attach to window for global drag handling
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        viewport.addEventListener('mousedown', handleMouseDown);

        viewport.style.cursor = 'grab';

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            viewport.removeEventListener('mousedown', handleMouseDown);
        };
    }, [image, frameRotation]);



    const add = async () => {
        setLoading(true);

        const data = await generateImageData();

        uploadPhoto({
            albumId: album.id,
            data: data as string
        }).then(res => {
            res.success ? addPhoto(res.data) : {}; //TODO: Throw error
            setLoading(false);
            close();
        })
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
            {loading && (
                <Center
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(255,255,255,0.6)',
                        zIndex: 9999,
                    }}
                >
                    <Loader size="lg" />
                </Center>
            )}

            <Modal radius="lg" size="auto" withCloseButton={false} opened onClose={() => { }} centered>
                <Center>
                    <ScrollArea
                        h={frameRotation ? 244 : 300}
                        w={frameRotation ? 300 : 244}
                        bg="white"
                        onScrollPositionChange={({ x, y }) => setImagePosition({ x, y })}
                        viewportRef={scrollViewportRef}
                    >
                        <div style={{ transform: 'scale(0.5)', display: 'inline-block', transformOrigin: 'center' }}>
                            <img src={image} draggable={false} style={{ transform: `scale(${imageScale})` }} alt="Editable content" />
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
                    <Button color="red" onClick={close} disabled={loading}>Cancel</Button>
                    <Button color="blue" onClick={add} disabled={loading}>Add</Button>
                </Group>
            </Modal>
            <canvas ref={canvasRef} hidden />
        </>
    );
}