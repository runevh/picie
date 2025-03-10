import { useState } from "react";
import { Photo, usePhoto } from "../../contexts/PhotoContext";
import { ActionIcon, Avatar, Button, Flex, Group, Modal, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Text, TextInput, Title } from "@mantine/core";
import { IconCheck, IconCopy, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { PhotoUploader } from "./PhotoUploader";

export interface PhotoCollageProps {
    id: number,
    name: string,
    photos: Photo[],
}

export interface PhotoCollageEditorProps extends PhotoCollageProps {
    close: () => void
}

function PhotoCollageEditor(props: PhotoCollageEditorProps) {
    const { saveCollage } = usePhoto();

    const [openAddImage, setOpenAddImage] = useState(false);
    const [images, setImages] = useState<Photo[]>(props.photos);
    const [cName, setCName] = useState<string>(props.name);
    const [editName, setEditName] = useState<boolean>(false);
    const [privacy, setPrivacy] = useState<string>('private');
    const [sharedUsers, setSharedUsers] = useState([
        { id: 1, name: 'Alice Smith', email: 'alice@example.com', avatar: '' },
    ]);

    const [shareLink] = useState(`http://example.com/collage/${props.id}`);

    const saveName = () => {
        saveCollage({ id: props.id, name: cName, photos: images }).then(res => {
            if (!res.success) {
                //TODO: Error popup
            } else {
                setEditName(false);
            }
        })
    }

    return (
        <>
            {openAddImage && <PhotoUploader id={props.id} addImage={(img) => setImages(p => [...p, img])} close={() => setOpenAddImage(false)} />}

            <Modal
                opened={true}
                withCloseButton={false}
                size="md"
                closeOnClickOutside={false}
                onClose={() => { }}
            >

                <Flex justify="space-between" align="center" my="md" mb='lg' h={30}>
                    {editName &&
                        <><TextInput
                            disabled={false}
                            variant={editName ? 'filled' : 'unstyled'}
                            value={cName}
                            onChange={(e) => setCName(e.currentTarget.value)}
                            placeholder="Collage name"
                            mr={20}
                            styles={{
                                input: {
                                    fontSize: '1.75rem',
                                    fontWeight: 400,
                                    height: 'auto',
                                    padding: 0,
                                }
                            }}
                            style={{ flex: 1 }}
                        />
                            <ActionIcon variant="light" onClick={() => {
                                saveName();
                            }}><IconCheck/></ActionIcon></>
                    }
                    {
                        !editName &&
                        <>
                            <Text size='1.75rem'>
                                {cName}
                            </Text>
                            <ActionIcon variant="light" onClick={() => {
                                setEditName(true);
                            }}><IconPencil /></ActionIcon>
                        </>
                    }
                </Flex>

                <Flex justify="space-between" align="center" mb="xl" gap="md">
                    <Text size="sm" fw={500}>Collage Privacy</Text>
                    <SegmentedControl
                        value={privacy}
                        onChange={(value) => setPrivacy(value)}
                        data={[
                            {
                                value: 'private',
                                label: <Text size="sm">Private</Text>,
                            },
                            {
                                value: 'public',
                                label: <Text size="sm">Public</Text>,
                            },
                            {
                                value: 'shared',
                                label: <Text size="sm">Shared</Text>,
                            },
                        ]}
                        radius="xl"
                        color="blue"
                        transitionDuration={200}
                    />
                </Flex>

                {privacy === 'shared' && (
                    <>
                        <Title size="xl" fw={400} order={4} mb="sm">Share</Title>
                        <TextInput
                            label="Shareable Link"
                            description="valid for 30 minutes"
                            value={shareLink}
                            readOnly
                            mb="md"
                            rightSection={
                                <ActionIcon variant="light"><IconCopy size={16}/></ActionIcon>
                            }
                        />
                        <Paper withBorder p="sm" radius="md">
                            <ScrollArea mah={130}>
                                {sharedUsers.map(user => (
                                    <Flex key={user.id} my={-8} align="center" justify="space-between" p="xs">
                                        <Flex align="center" gap="xs">
                                            <Avatar size="sm" radius="xl">{user.name[0]}</Avatar>
                                            <div>
                                                <Text size="sm">{user.name}</Text>
                                                <Text size="xs" c="dimmed">{user.email}</Text>
                                            </div>
                                        </Flex>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            onClick={() => { }}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Flex>
                                ))}
                            </ScrollArea>
                        </Paper>
                    </>
                )}

                <Flex justify="space-between" align="center" my="md">
                    <Title size="xl" fw={400}>Photos</Title>
                    <Group>
                        <ActionIcon variant="light"><IconPencil /></ActionIcon>
                        <ActionIcon variant="light" onClick={() => setOpenAddImage(true)}><IconPlus /></ActionIcon>
                    </Group>
                </Flex>

                <Paper withBorder p={6} radius={14}>
                    <ScrollArea h={250}>
                        <SimpleGrid cols={3} spacing="sm">
                            {images.map((img, index) => (
                                <div key={index} style={{
                                    height: 122,
                                    width: 122,
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#ffffff',
                                }}>
                                    <img src={import.meta.env.VITE_API_URL + "/api/photo/get/" + img.id + ".png"} style={{ maxHeight: '100%', objectFit: 'cover' }} alt="" />
                                </div>
                            ))}
                        </SimpleGrid>
                    </ScrollArea>
                </Paper>

                <Group mt="md" justify="right">
                    <Button color="red" leftSection={
                        <IconTrash size={16}></IconTrash>
                    }>Delete</Button>
                    <Button color="blue" onClick={() => props.close()}>Done</Button>
                </Group>
            </Modal>
        </>
    )
}

export default PhotoCollageEditor;