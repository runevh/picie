import { ActionIcon, Button, Center, Checkbox, Chip, Container, Divider, Flex, Group, Menu, Modal, Paper, RangeSlider, ScrollArea, Select, SimpleGrid, Slider, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconFilter, IconPencil, IconPhoto, IconPlus, IconSearch, IconUpload, IconX } from "@tabler/icons-react";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useEffect, useRef, useState } from "react";

export function DitheredImage({ imageSrc, zoom }: { imageSrc: any, zoom: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [palette, setPalette] = useState<string[]>(["#03162b", "#F2E9D8", "#2E9455", "#2B528C", "#B34040", "#9A432", "#D95C32", "#EDD4A6"]); // Default 8 colors

    useEffect(() => {
        applyDithering();
    }, []);

    const applyDithering = () => {
        console.log(imageSrc);
        if (!imageSrc || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.src = imageSrc;


        img.onload = () => {
            console.log("image loaded");
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    let index = (y * canvas.width + x) * 4;
                    let oldColor = [data[index], data[index + 1], data[index + 2]];
                    let newColor = findClosestPaletteColor(oldColor, palette);

                    data[index] = newColor[0];
                    data[index + 1] = newColor[1];
                    data[index + 2] = newColor[2];

                    let error = [
                        oldColor[0] - newColor[0],
                        oldColor[1] - newColor[1],
                        oldColor[2] - newColor[2]
                    ];

                    distributeError(data, x + 1, y, error, 7 / 16, canvas.width);
                    distributeError(data, x - 1, y + 1, error, 3 / 16, canvas.width);
                    distributeError(data, x, y + 1, error, 5 / 16, canvas.width);
                    distributeError(data, x + 1, y + 1, error, 1 / 16, canvas.width);
                }
            }

            // Update canvas
            ctx.putImageData(imageData, 0, 0);
        };
    };

    const findClosestPaletteColor = (color: number[], palette: string[]) => {
        let closest = palette[0];
        let closestDistance = Infinity;

        palette.forEach((hex) => {
            let [r, g, b] = hexToRGB(hex);
            let distance = Math.sqrt(
                (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2
            );

            if (distance < closestDistance) {
                closestDistance = distance;
                closest = hex;
            }
        });

        return hexToRGB(closest);
    };

    const hexToRGB = (hex: string): number[] => {
        let bigint = parseInt(hex.slice(1), 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const distributeError = (data: Uint8ClampedArray, x: number, y: number, error: number[], factor: number, width: number) => {
        if (x < 0 || x >= width || y < 0) return;

        let index = (y * width + x) * 4;
        data[index] += error[0] * factor;
        data[index + 1] += error[1] * factor;
        data[index + 2] += error[2] * factor;
    };

    return (
        <canvas ref={canvasRef} />
    );
}


export function ImageEditor(image: any) {
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [imageRotation, setImageRotation] = useState(0);
    const [frameRotation, setFrameRotation] = useState(0);

    const handleImageDrag = (e: any, data: any) => {
        setImagePosition({ x: data.x, y: data.y });
    };

    const [value, setValue] = useState<string | null>('horizontal');
    const handleChipClick = (event: React.MouseEvent<HTMLInputElement>) => {

    };

    return <>
        <Modal radius={'lg'} size="auto" withCloseButton={false} opened onClose={() => { }} centered>
            <Center>
                <ScrollArea h={224} w={300} bg={'white'}>
                    <div
                        style={{
                            transform: `scale(${1 / 2})`,
                            display: "inline-block",
                            transformOrigin: "center",
                        }}
                    >
                        <DitheredImage imageSrc={image.image} zoom={1} />
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

                                <Chip size={'sm'} variant='light' value="horizontal" onClick={handleChipClick}>
                                    Horizontal
                                </Chip>
                                <Chip size={'sm'} variant='light' value="vertical" onClick={handleChipClick}>
                                    Vertical
                                </Chip>

                            </Chip.Group>
                        </Group>
                    </Flex>
                </Center>
            </Container>
            <Group justify={'center'}>
                <Button color="blue">Add</Button>
                <Button color="red">Cancel</Button>
            </Group>
        </Modal>
    </>
}

export function ImageUploader() {
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
            <Modal withCloseButton={false} opened onClose={() => { }} centered size={'lg'}>
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
            <ImageEditor image={uploadedImage} />
        )}
    </>
}

function Images() {
    const [openCreateCollage, setOpenCreateCollage] = useState(false);
    const [openAddImage, setOpenAddImage] = useState(false);

    return (
        <>
            {openAddImage && <ImageUploader />}
            <Modal opened={openCreateCollage} onClose={() => setOpenCreateCollage(false)} centered title="Create new photo collage">

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
                    <ScrollArea h={300}>
                        <SimpleGrid cols={3} spacing="sm">
                            {/* Replace with actual images */}
                            {[...Array(9)].map((_, index) => (
                                <div key={index} style={{ height: 150, width: 122, backgroundColor: '#ddd', borderRadius: 8 }}></div>
                            ))}
                        </SimpleGrid>
                    </ScrollArea>
                </Paper>

                <Divider my="md" />

                <Button fullWidth>Save</Button>
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
                {/*
                    <Text size="lg" c="gray.7">There are no devices yet linked to your account.</Text>
                    <Button w={200}rightSection={<IconPlus size={14} />}>Add new Device</Button>
                */}
                {
                }
            </Stack>
        </>
    )
}

export default Images;