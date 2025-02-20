import { useEffect, useState } from "react";
import { Carousel } from '@mantine/carousel';
import { Image, Button, Card, Stack, Text, Title, Group, Badge, Indicator, Avatar, Modal, TextInput, Stepper, PinInput, Center, Menu, Checkbox } from "@mantine/core";
import styles from './Devices.module.scss';
import { IconFilter, IconPlugConnected, IconPlus, IconSearch } from "@tabler/icons-react";
import { useDeviceContext } from "../contexts/DeviceContext";

const DeviceState = {
    ONLINE: { status: 'online', color: 'green' }, // props.online = true
    OFFLINE: { status: 'offline', color: 'red' }, // props.online = false and props.lastSeen is not null
    UPDATING: { status: 'updating', color: 'blue' }, //props.updaring = true
    UNLINKED: { status: 'unlinked', color: 'gray' }, // props.online = false and props.owner is undefined
    NEW: { status: 'NEW', color: 'yellow' }
};

function getDeviceState(props: any) {
    if (props.online) {
        return DeviceState.ONLINE;
    }

    if (props.updating) {
        return DeviceState.UPDATING;
    }

    if (props.lastSeen === null) {
        if (props.owner === undefined) {
            return DeviceState.NEW;
        } else {
            return DeviceState.UNLINKED;
        }
    }

    return DeviceState.OFFLINE;
}

interface Device {
    id: string;
    lastSeen: Date | null;
    name: string | null;
}

interface DeviceProps {
    role: 'OWNER' | 'EDIT' | 'READ';
    createdAt: string;
    updatedAt: string;
    userId: number;
    deviceId: string;
    Device: Device;
    online: boolean;
    updating: boolean;
}

const images = [
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
];

export const DeviceCard: React.FC<DeviceProps> = (props) => {

    const state = getDeviceState(props);

    const slides = images.map((image) => (
        <Carousel.Slide key={image}>
            <Image src={image} height={160} />
        </Carousel.Slide>
    ));

    return <Indicator size={21} withBorder processing disabled>
        <Card shadow="sm" padding="lg" radius="md" withBorder w={300}>
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
                <Text fw={500}>{props.Device.name ? props.Device.name : props.Device.id}</Text>
                <Badge color={state.color}>{state.status}</Badge>
            </Group>

            <Group>
                <Avatar size="sm" />
                <Text c="dimmed" ml={-10} size="sm">Owned by {props.role === "OWNER" ? "you" : "someone else"}</Text>
            </Group>

            <Button color="blue" fullWidth mt="md" radius="md">
                View
            </Button>
        </Card>
    </Indicator>
}

function Devices() {

    //const [devices, setDevices] = useState([]);
    const [addProgress, setAddProgress] = useState(0);
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [deviceKey, setDeviceKey] = useState('');
    const [devices, setDevices] = useState<DeviceProps[]>([]);

    const { getAllUserDevices } = useDeviceContext();

    useEffect(() => {
        getAllUserDevices().then((res) => {
            setDevices((_prev) => res.data.data);
        });
    }, []);

    const { startClaimDevice } = useDeviceContext();

    const closeAddDevice = () => {
        setShowAddDevice(false);
    }

    const openAddDevice = () => {
        setShowAddDevice(true);
        setAddProgress(0);
    }

    const deviceKeyEntered = () => {
        startClaimDevice(deviceKey).then((res) => {
            console.log(res);
        })
    }

    return (
        <>
            <Modal opened={showAddDevice} onClose={closeAddDevice} title={"Add a new Device"} p={40}>
                <Stepper active={addProgress}>
                    <Stepper.Step description="" icon={<IconSearch size={18} />}>
                        <Stack>
                            <TextInput onChange={(e) => setDeviceKey(e.target.value)} label="Enter Device Key" description="This key can be found at the back of your device." placeholder="e.g. ABC123DEF" mb={10} />
                            <Button variant="filled" onClick={() => deviceKeyEntered()}>Next</Button>
                        </Stack>
                    </Stepper.Step>

                    <Stepper.Step icon={<IconPlugConnected size={18} />}>
                        <Stack>
                            <Text>A pairing code will appear on the device. Enter it here down below. This code will be valid for 15 minutes.</Text>
                            <Center><PinInput mt={15} mb={15} placeholder="" type="number" /></Center>
                            <Button variant="filled" onClick={() => setAddProgress(2)}>Next</Button>
                        </Stack>
                    </Stepper.Step>
                    <Stepper.Step icon={<IconSearch size={18} />}>
                        <Stack>
                            <Text>Select a collage to display.</Text>
                        </Stack>
                    </Stepper.Step>
                </Stepper>




            </Modal>
            <Stack>
                <Group align="center">
                    <Title fw={400}>Devices</Title>

                    <Button radius="xl" onClick={openAddDevice} variant="light" ml={15}>
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
                        placeholder="Search devices"
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
                    devices.map(dev => {
                        return <DeviceCard role={dev.role} createdAt={dev.createdAt} updatedAt={dev.updatedAt} userId={0} deviceId={dev.Device.id} Device={dev.Device} online={dev.online} updating={dev.updating}></DeviceCard>
                    })
                }
            </Stack>
        </>
    )
}

export default Devices;