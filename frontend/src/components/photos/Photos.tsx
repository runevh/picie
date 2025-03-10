import { useState } from 'react';
import {
    ActionIcon,
    Button,
    Checkbox,
    Flex,
    Group,
    Menu,
    Modal,
    Paper,
    ScrollArea,
    Text,
    Image,
    Stack,
    TextInput,
    Title,
    Card,
    Avatar
} from '@mantine/core';
import styles from './Photos.module.scss';
import { IconCheck, IconFilter, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { Photo, usePhoto } from '../../contexts/PhotoContext';
import PhotoCollageEditor, { PhotoCollageEditorProps, PhotoCollageProps } from './PhotoCollageEditor';
import { Carousel } from '@mantine/carousel';

interface CollageCardProps extends PhotoCollageEditorProps {
    edit: (collage: PhotoCollageEditorProps) => void
}

export const CollageCard: React.FC<CollageCardProps> = (props) => {
    const slides = props.photos.map((image) => (
        <Carousel.Slide key={image.id}>
            <Image src={import.meta.env.VITE_API_URL + "/api/photo/get/" + image.id + ".png"} height={160} />
        </Carousel.Slide>
    ));

    return <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder w={300}>
        <Card.Section>
            <Carousel
                loop
                withIndicators
                classNames={styles}
            >
                {slides}
            </Carousel>
        </Card.Section>

        <Group justify="space-between" mt="md" mb="xs">
            <Text fw={500}>{props.name}</Text>
        </Group>

        <Group>
            <Avatar size="sm" />
            <Text c="dimmed" ml={-10} size="sm">Owned by you</Text>
        </Group>

        <Button color="blue" fullWidth mt="md" radius="md" onClick={() => {
            props.edit(props);
        }}>
            Edit
        </Button>
    </Card>
}

function Photos() {
    const { createCollage, collages } = usePhoto();

    const [openEditCollage, setOpenEditCollage] = useState(false);
    const [currentCollage, setCurrentCollage] = useState<PhotoCollageEditorProps>();

    const create = () => {
        createCollage().then((res) => {
            if (res.success) {
                setCurrentCollage({
                    id: res.data.id,
                    name: res.data.name,
                    photos: [],
                    close: () => {setOpenEditCollage(false)}
                })
                setOpenEditCollage(true);
            }
        })
    }

    const edit = (collage: PhotoCollageEditorProps) => {
        setCurrentCollage({
            id: collage.id,
            name: collage.name,
            photos: collage.photos,
            close: () => {setOpenEditCollage(false)}
        })
        setOpenEditCollage(true);
    }

    return (
        <>
            {openEditCollage && <PhotoCollageEditor {...currentCollage as PhotoCollageEditorProps}></PhotoCollageEditor>}
            <Stack>
                <Group align="center">
                    <Title fw={400}>Image Collages</Title>
                    <Button radius="xl" onClick={() => create()} variant="light"><IconPlus /></Button>

                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <Button radius="xl" variant="light"><IconFilter /></Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>Active filters</Menu.Label>
                            {['Online', 'Offline', 'Updating', 'Unlinked'].map((label) => (
                                <Menu.Item key={label}>
                                    <Checkbox defaultChecked label={label} />
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>

                    <TextInput
                        radius="xl"
                        placeholder="Search Collages"
                        rightSection={<IconSearch size={18} />}
                    />
                </Group>
                {collages.map(collage =>
                    <CollageCard edit={edit} id={collage.id} name={collage.name} photos={collage.photos} close={() => {
                        setOpenEditCollage(false);
                        console.log("test");
                    }} />
                )}
            </Stack>

        </>
    );
}

export default Photos;