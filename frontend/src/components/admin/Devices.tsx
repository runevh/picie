import { Button, Card, Group, Text, Badge, Modal, Stack, Title, Avatar, TextInput, ActionIcon, Menu, Checkbox, SimpleGrid, Pagination } from "@mantine/core";
import { IconFilter, IconPlus, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useDeviceContext } from "../../contexts/DeviceContext";

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


interface DeviceProps {
    Users: any;
    id: String,
    owner: any,
    lastSeen: Date,
    online: boolean
}

export const DeviceCard: React.FC<DeviceProps> = (props) => {
    const state = getDeviceState(props);

    return (
        <Card shadow="sm" padding="lg" radius="md" withBorder w={300}>
            <Group justify="space-between" mb="xs">
                <Text fw={500}>{props.id}</Text>
                <Badge color={state.color}>{state.status}</Badge>
            </Group>

            <Group>
                <Avatar size="sm"/>
                {
                    props.owner &&  <Text c="dimmed" ml={-10} size="sm">Owned by {props.owner?.username}</Text>
                }

                {
                    !props.owner && <Text c="dimmed" ml={-10} size="sm">Unlinked</Text>
                }
            </Group>

            <Button color="blue" fullWidth mt="md" radius="md">
                View
            </Button>
        </Card>
    )
}

const PAGE_SIZE = 2;

function AdminDevices() {

    //const [devices, setDevices] = useState([]);
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [activePage, setActivePage] = useState(1);
    const [devices, setDevices] = useState<DeviceProps[]>([]);
    const { createDevice, getAllDevices } = useDeviceContext();

    const startIdx = (activePage - 1) * PAGE_SIZE;
    const displayed = devices.slice(startIdx, startIdx + PAGE_SIZE);

    const closeCreateDevice = () => {
        setShowAddDevice(false);
    }

    const openCreateDevice = () => {
        setShowAddDevice(true);
    }

    const createDev = () => {
        createDevice().then((res) => {
            setDevices((prev) => prev.concat(res.data.data));
        });
    }

    useEffect(() => {
        getAllDevices().then((res) => {
            //console.log(res.data.data);
            setDevices(res.data.data);
        });
    }, []);

    return (
        <>
            <Modal opened={showAddDevice} onClose={closeCreateDevice} title={"Create a new Device"} p={40}>
                <Text>
                    Are you sure you want to create a new device?
                </Text>
                <Group mt="lg" justify="flex-end">
                    <Button onClick={closeCreateDevice} color="red">
                        Cancel
                    </Button>
                    <Button onClick={() => { createDev(); closeCreateDevice() }} color="green">
                        Continue
                    </Button>
                </Group>
            </Modal>

            <Stack>
                <Group align="center">
                    <Title fw={400}>Devices</Title>

                    <Button radius="xl" onClick={openCreateDevice} variant="light" ml={15}>
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
                    {devices.map(dev => {
                        return <DeviceCard online={dev.online} owner={dev.Users?.[0]} id={dev.id} lastSeen={dev.lastSeen} Users={undefined}></DeviceCard>
                    })}

                <Pagination
                    total={Math.ceil(devices.length / PAGE_SIZE)} // Total pages
                    value={activePage}
                    onChange={setActivePage}
                    mt="md"
                />
            </Stack>
        </>
    )
}

export default AdminDevices;