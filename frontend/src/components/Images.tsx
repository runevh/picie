import { ActionIcon, Button, Center, Checkbox, Chip, Container, Divider, Flex, Group, Menu, Modal, Paper, RangeSlider, ScrollArea, Select, SimpleGrid, Slider, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconFilter, IconPencil, IconPhoto, IconPlus, IconSearch, IconUpload, IconX } from "@tabler/icons-react";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useRef, useState } from "react";
import { usePhoto } from "../contexts/PhotoContext";

export function ImageEditor({ image, close, addImage }: { image: string; close: () => void, addImage: (img: any) => void }) {
    const { uploadPhoto } = usePhoto();
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [frameRotation, setFrameRotation] = useState(1);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageScale, setImageScale] = useState(1);

    const handleImageDrag = (e: any, data: any) => {
        setImagePosition({ x: data.x, y: data.y });
    };

    const [value, setValue] = useState<string | null>('horizontal');
    const setVertical = (event: React.MouseEvent<HTMLInputElement>) => {
        setFrameRotation(1);
    };

    const setHorizontal = (event: React.MouseEvent<HTMLInputElement>) => {
        setFrameRotation(0);
    };

    const addPhoto = async () => {
        await generateImageData().then(data => {
            uploadPhoto(data).then(res => {
                console.log("response", res);
                const uint8Array = new Uint8Array(res.data.data);
                const blob = new Blob([uint8Array], { type: 'image/png' });
                const url = URL.createObjectURL(blob);
                addImage(url);
                close();
            });
        });
    }

    const generateImageData = async () => {
        return new Promise((resolve, reject) => {
            if (!image || !canvasRef.current) return reject("No image or canvas reference");

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject("Could not get canvas context");

            const img = new Image();
            img.src = image;

            img.onload = () => {
                canvas.width = frameRotation ? 600 : 488;
                canvas.height = frameRotation ? 488 : 600;
                ctx.clearRect(0, 0, 600, 488);

                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(
                    img,
                    img.width / 2 - imagePosition.x * 2 - (imageScale - 1) * img.width / 2,
                    img.height / 2 - imagePosition.y * 2 - (imageScale - 1) * img.height / 2,
                    img.width * imageScale,
                    img.height * imageScale
                );

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject("Could not generate blob");
                    }
                }, 'image/png');
            };

            img.onerror = (error) => {
                reject(error);
            };
        });

    };

    return <>
        <Modal radius={'lg'} size="auto" withCloseButton={false} opened onClose={() => { }} centered>
            <Center>
                <ScrollArea
                    defaultValue={50}
                    h={frameRotation ? 244 : 300}
                    w={frameRotation ? 300 : 244}
                    bg={'white'}
                    type="auto"
                    style={{ cursor: 'grab' }}
                    onScrollPositionChange={({ x, y }) => { setImagePosition({ x, y }) }}>
                    <div
                        style={{
                            transform: `scale(${1 / 2})`,
                            display: "inline-block",
                            transformOrigin: "center",
                        }}
                    >
                        <img src={image} style={{
                            //width: '600px'
                            //height: `${2 * imageScale}%`
                            transform: `scale(${imageScale})`
                        }} />
                    </div>
                </ScrollArea>
            </Center>
            <Container mt={10} mb={30} w={256}>
                <Text>Zoom</Text>
                <Slider
                    color="blue"
                    min={1}
                    defaultValue={100}
                    max={200}
                    onChange={(e) => { setImageScale(e.valueOf() / 100) }}
                    marks={[
                        { value: 50, label: '50%' },
                        { value: 100, label: '100%' },
                        { value: 150, label: '150%' },
                    ]}
                />
            </Container>
            <Container>
                <Center>
                    <Flex mt={10} mb={30} w={224} justify={'space-between'}>
                        <Text>Orientation:</Text>
                        <Group justify={'end'}>
                            <Chip.Group multiple={false} value={value} onChange={setValue}>

                                <Chip size={'sm'} variant='light' value="horizontal" onClick={setVertical}>
                                    Horizontal
                                </Chip>
                                <Chip size={'sm'} variant='light' value="vertical" onClick={setHorizontal}>
                                    Vertical
                                </Chip>

                            </Chip.Group>
                        </Group>
                    </Flex>
                </Center>
            </Container>
            <Group justify={'center'}>
                <Button color="blue" onClick={() => addPhoto()}>Add</Button>
                <Button color="red" onClick={() => { close() }}>Cancel</Button>
            </Group>
        </Modal>
        <canvas ref={canvasRef} hidden />
    </>
}

export function ImageUploader({ close, addImage }: { close: () => void, addImage: (img: any) => void }) {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);

    const handleImageUpload = (files: File[]) => {
        if (files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target?.result as string);
                // TODO: Stop loading
            };
            reader.readAsDataURL(file);
        }
    };

    return <>
        {!uploadedImage ? (
            <Modal withCloseButton={false} opened onClose={close} centered size={'lg'}>
                <Title size={'xl'} fw={300}>Add Photo</Title>
                <Dropzone
                    multiple={false}
                    onDrop={handleImageUpload}
                    onReject={(files) => console.log('rejected files', files)}
                    maxSize={10 * 1024 ** 2}
                    accept={IMAGE_MIME_TYPE}
                >
                    <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
                        <Dropzone.Accept>
                            <IconUpload size={52} color="var(--mantine-color-blue-6)" stroke={1.5} />
                        </Dropzone.Accept>
                        <Dropzone.Reject>
                            <IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
                        </Dropzone.Reject>
                        <Dropzone.Idle>
                            <IconPhoto size={52} color="var(--mantine-color-dimmed)" stroke={1.5} />
                        </Dropzone.Idle>

                        <div>
                            <Text size="xl" inline>
                                Drag image here or click to select file
                            </Text>
                            <Text size="sm" c="dimmed" inline mt={7}>
                                Attach 1 file, should not exceed 10MB
                            </Text>
                        </div>
                    </Group>
                </Dropzone>
            </Modal>
        ) : (
            <ImageEditor addImage={addImage} close={() => close()} image={uploadedImage} />
        )}
    </>
}

function Images() {
    const [openCreateCollage, setOpenCreateCollage] = useState(false);
    const [openAddImage, setOpenAddImage] = useState(false);
    const [images, setImages] = useState<string[]>([]);

    const addImage = (image: any) => {
        setImages((p) => {
            return [...p, image];
        })
    }

    return (
        <>
            {openAddImage && <ImageUploader addImage={addImage} close={() => { setOpenAddImage(false) }} />}
            <Modal withCloseButton={false} closeOnEscape={false} closeOnClickOutside={false} opened={openCreateCollage} onClose={() => setOpenCreateCollage(false)} centered title="Create new photo collage">

                <Group>
                    <TextInput placeholder="Collage name" mb="md" radius={'xl'} />
                    <Select
                        label="Gallery Visibility"
                        data={['Public', 'Private', 'Friends', 'Selected People']}
                        placeholder="Choose visibility"
                        mb="md"
                    />
                </Group>
                <Group justify="space-between" mb={'sm'}>
                    <Title size="xl" fw={400} >Photos</Title>
                    <Group>
                        <ActionIcon variant="light" aria-label="Edit" mr={-8}>
                            <IconPencil />
                        </ActionIcon>
                        <ActionIcon variant="light" aria-label="Add" onClick={() => setOpenAddImage(true)}>
                            <IconPlus />
                        </ActionIcon>
                    </Group>
                </Group>
                <Paper withBorder p={6} radius={14}>
                    <ScrollArea h={250}>
                        <SimpleGrid cols={3} spacing="sm">
                            {/* Replace with actual images */}
                            {/*[...Array(9)].map((_, index) => (
                                <div key={index} style={{ height: 122, width: 122, backgroundColor: '', borderRadius: 8 }}></div>
                            ))*/}
                            {images.map((img, index) => {
                                return (
                                    <div
                                        key={index}
                                        style={{
                                            height: 122,
                                            width: 122,
                                            borderRadius: 8,
                                            overflow: "hidden", // Ensures the image doesn’t overflow
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: "#ffffff", // Optional: gives a background to see the box clearly
                                        }}
                                    >
                                        <img
                                            src={img}
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "100%",
                                                objectFit: "cover", // Ensures the image scales properly within the container
                                                display: "block",
                                            }}
                                            alt={`image-${index}`}
                                        />
                                    </div>
                                );
                            })}

                        </SimpleGrid>
                    </ScrollArea>
                </Paper>

                <Divider my="md" />
                <Button variant="default">Cancel</Button>
                <Button color="blue">Save</Button>

            </Modal>
            <Stack>
                <Group align="center">
                    <Title fw={400}>Image Collages</Title>

                    <Button radius="xl" onClick={() => setOpenCreateCollage(true)} variant="light" ml={15}>
                        <IconPlus />
                    </Button>

                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <Button radius="xl" variant="light">
                                <IconFilter stroke={1.3} />
                            </Button>
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>Active filters</Menu.Label>
                            <Menu.Item>
                                <Checkbox
                                    defaultChecked
                                    label="Online"
                                />
                            </Menu.Item>
                            <Menu.Item>
                                <Checkbox
                                    defaultChecked
                                    label="Offline"
                                />
                            </Menu.Item>
                            <Menu.Item>
                                <Checkbox
                                    defaultChecked
                                    label="Updating"
                                />
                            </Menu.Item>
                            <Menu.Item>
                                <Checkbox
                                    defaultChecked
                                    label="Unlinked"
                                />
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>

                    <TextInput
                        radius="xl"
                        placeholder="Search Collages"
                        rightSection={
                            <IconSearch size={18} stroke={1.5} />
                        }
                    />

                </Group>
            </Stack>
        </>
    )
}

export default Images;