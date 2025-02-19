import { useState } from "react";
import { Carousel } from '@mantine/carousel';
import { Image, Button, Card, Stack, Text, Title, Group, Badge, Indicator, Avatar, Modal, TextInput, Stepper, PinInput, Center } from "@mantine/core";
import styles from './Devices.module.scss';
import { IconPlugConnected, IconPlus, IconSearch } from "@tabler/icons-react";

interface DeviceProps {
    name: String,
    state: String
}

const images = [
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
    'https://gratisography.com/wp-content/uploads/2025/01/gratisography-dog-vacation-800x525.jpg',
];

export const DeviceCard: React.FC<DeviceProps> = (props) => {

    const slides = images.map((image) => (
        <Carousel.Slide key={image}>
            <Image src={image} height={160} />
        </Carousel.Slide>
    ));

    return <Indicator size={21} withBorder processing>
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
                <Text fw={500}>{props.name}</Text>
                <Badge color="Green">{props.state}</Badge>
            </Group>

            <Group>
                <Avatar size="sm" />
                <Text c="dimmed" ml={-10} size="sm">Owned by you</Text>
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

    const closeAddDevice = () => {
        setShowAddDevice(false);
    }

    const openAddDevice = () => {
        setShowAddDevice(true);
        setAddProgress(0);
    }

    return (
        <>
            <Modal opened={showAddDevice} onClose={closeAddDevice} title={"Add a new Device"} p={40}>
                <Stepper active={addProgress}>
                    <Stepper.Step description="" icon={<IconSearch size={18} />}>
                        <Stack>
                            <TextInput label="Enter Device Key" description="This key can be found at the back of your device." placeholder="e.g. ABC123DEF" mb={10} />
                            <Button variant="filled" onClick={() => setAddProgress(1)}>Next</Button>
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
                <Group align="baseline">
                    <Title fw={400}>Devices</Title>

                    <Button radius="xl" onClick={openAddDevice} variant="light" ml={15}>
                        <IconPlus />
                    </Button>

                </Group>
                {/*
                    <Text size="lg" c="gray.7">There are no devices yet linked to your account.</Text>
                    <Button w={200}rightSection={<IconPlus size={14} />}>Add new Device</Button>
                */}
                <DeviceCard name={"Test Bedroom"} state={"Online"}></DeviceCard>
            </Stack>
        </>
    )
}

export default Devices;