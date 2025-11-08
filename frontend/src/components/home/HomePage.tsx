import { useMemo } from "react";
import {
  Box,
  Button,
  Divider,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowRight,
  IconCircleCheck,
  IconDeviceMobile,
  IconPhoto,
  IconSparkles,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { usePhoto } from "../../contexts/PhotoContext";

const highlightTiles = [
  {
    title: "Curate stunning albums",
    description: "Drag in your best shots, collaborate with family, and keep everything organized with powerful filters.",
    icon: IconPhoto,
  },
  {
    title: "Send magic to every frame",
    description: "Beam new memories to any frame in seconds. Schedule drops or surprise drops from anywhere.",
    icon: IconDeviceMobile,
  },
  {
    title: "Share with the people that matter",
    description: "Invite collaborators, manage access, and keep the whole crew in sync with gentle notifications.",
    icon: IconUsersGroup,
  },
];

const journeySteps = [
  "Create or import the albums that tell your story.",
  "Connect a frame and personalize its vibe.",
  "Share invites so friends can contribute their own snapshots.",
  "Sit back while Picie keeps frames updated with fresh favorites.",
];

export function HomePage() {
  const navigate = useNavigate();
  const { albums } = usePhoto();

  const stats = useMemo(
    () => [
      {
        label: "Albums curated",
        value: albums.length,
      },
      {
        label: "Photos stored",
        value: albums.reduce((acc, album) => acc + album.photos.length, 0),
      },
      {
        label: "Collaborators",
        value: albums.reduce((acc, album) => acc + (album.collaborators?.length ?? 0), 0),
      },
    ],
    [albums],
  );

  return (
    <Stack gap="xl" p="md">
      <Paper
        radius="lg"
        p="xl"
        withBorder
        style={{
          background: "linear-gradient(135deg, rgba(52, 125, 244, 0.15), rgba(241, 243, 245, 0.6))",
        }}
      >
        <Stack gap="lg">
          <Box>
            <Title order={1} size="h2">
              Welcome back to Picie
            </Title>
            <Text c="dimmed" mt={8} size="lg">
              A home for every photo and every frame. Pick up where you left off, or start curating something brand new.
            </Text>
          </Box>
          <Group gap="md" wrap="wrap">
            <Button size="md" leftSection={<IconPhoto size={18} />} onClick={() => navigate("/photos")}>
              Go to albums
            </Button>
            <Button
              size="md"
              variant="default"
              leftSection={<IconDeviceMobile size={18} />}
              onClick={() => navigate("/frames")}
            >
              View frames
            </Button>
          </Group>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {highlightTiles.map(({ title, description, icon: Icon }) => (
          <Paper key={title} radius="lg" p="lg" withBorder>
            <Stack gap="sm">
              <ThemeIcon size="lg" variant="light" color="blue">
                <Icon size={18} />
              </ThemeIcon>
              <Text fw={600}>{title}</Text>
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper radius="lg" withBorder p="lg">
        <Stack gap="md">
          <Group align="baseline" justify="space-between" wrap="wrap">
            <Title order={3} size="h4">
              Your creative heartbeat
            </Title>
            <Button variant="subtle" rightSection={<IconArrowRight size={16} />} onClick={() => navigate("/admin")}>
              Open admin tools
            </Button>
          </Group>
          <Divider />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {stats.map((stat) => (
              <Stack key={stat.label} gap={4}>
                <Text fw={600} size="xl">
                  {stat.value}
                </Text>
                <Text size="sm" c="dimmed">
                  {stat.label}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper radius="lg" withBorder p="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="teal">
              <IconSparkles size={16} />
            </ThemeIcon>
            <Text fw={600}>A gentle guide</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Whether you are onboarding a brand-new frame or refreshing a family favorite, the flow is always the same:
          </Text>
          <List
            spacing="sm"
            icon={
              <ThemeIcon color="teal" size={20} radius="xl">
                <IconCircleCheck size={14} />
              </ThemeIcon>
            }
          >
            {journeySteps.map((step) => (
              <List.Item key={step}>{step}</List.Item>
            ))}
          </List>
        </Stack>
      </Paper>
    </Stack>
  );
}
