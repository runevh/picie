import { useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowRight,
  IconDeviceMobile,
  IconPhoto,
  IconSparkles,
  IconUsersGroup,
} from "@tabler/icons-react";
import { NavigateFunction, useNavigate } from "react-router-dom";
import { usePhoto } from "../../contexts/PhotoContext";

const quickLinks = [
  {
    title: "Albums",
    description: "Jump back into curation, add photos, and tidy up names.",
    icon: IconPhoto,
    action: (navigate: NavigateFunction) => navigate("/photos"),
  },
  {
    title: "Frames",
    description: "See what's live, nudge updates, and keep sets in sync.",
    icon: IconDeviceMobile,
    action: (navigate: NavigateFunction) => navigate("/frames"),
  },
  {
    title: "Admin",
    description: "Invites, access, and the controls you tweak the most.",
    icon: IconSparkles,
    action: (navigate: NavigateFunction) => navigate("/admin"),
  },
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

  const recentAlbums = useMemo(() => [...albums].slice(-4).reverse(), [albums]);
  const totalCollaborators = useMemo(
    () => albums.reduce((acc, album) => acc + (album.collaborators?.length ?? 0), 0),
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
              Welcome back
            </Title>
            <Text c="dimmed" mt={8} size="lg">
              Everything's in place. Here's a quick snapshot before you dive back in.
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
          <Group gap="sm" wrap="wrap">
            <Badge variant="light" color="blue">{albums.length} albums</Badge>
            <Badge variant="light" color="gray">{stats[1].value} photos</Badge>
            <Badge variant="light" color="teal">{totalCollaborators} collaborators</Badge>
          </Group>
        </Stack>
      </Paper>

      <Paper radius="lg" withBorder p="lg">
        <Stack gap="md">
          <Group align="baseline" justify="space-between" wrap="wrap">
            <Title order={3} size="h4">
              Quick links
            </Title>
            <Text size="sm" c="dimmed">
              Straight to the places you use most.
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {quickLinks.map(({ title, description, icon: Icon, action }) => (
              <Paper
                key={title}
                radius="lg"
                p="lg"
                withBorder
                onClick={() => action(navigate)}
                style={{ cursor: "pointer" }}
              >
                <Stack gap="sm">
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="light" color="blue">
                      <Icon size={18} />
                    </ThemeIcon>
                    <Text fw={600}>{title}</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {description}
                  </Text>
                  <Group gap={6}>
                    <Text size="sm" fw={500} c="blue">
                      Open
                    </Text>
                    <IconArrowRight size={14} color="var(--mantine-color-blue-6)" />
                  </Group>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>

      <Paper radius="lg" withBorder p="lg">
        <Stack gap="md">
          <Group align="baseline" justify="space-between" wrap="wrap">
            <Title order={3} size="h4">
              At a glance
            </Title>
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
          <Group align="baseline" justify="space-between" wrap="wrap">
            <Group gap="sm">
              <ThemeIcon variant="light" color="teal">
                <IconSparkles size={16} />
              </ThemeIcon>
              <Text fw={600}>Recent albums</Text>
            </Group>
            <Button variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />} onClick={() => navigate("/photos")}>
              View all
            </Button>
          </Group>
          <Divider />
          {recentAlbums.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {recentAlbums.map((album) => {
                const collaboratorCount = album.collaborators?.length ?? 0;
                const isShared = collaboratorCount > 0;
                return (
                  <Paper key={album.id} withBorder radius="md" p="md">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={600} lineClamp={1}>
                          {album.name || "Untitled album"}
                        </Text>
                        <Badge variant="light" color={isShared ? "teal" : "gray"}>
                          {isShared ? "Shared" : "Private"}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {album.photos.length} {album.photos.length === 1 ? "photo" : "photos"}
                      </Text>
                      <Group gap="md">
                        <Group gap={6}>
                          <ThemeIcon variant="light" color="gray">
                            <IconPhoto size={14} />
                          </ThemeIcon>
                          <Text size="sm">Album</Text>
                        </Group>
                        <Group gap={6}>
                          <ThemeIcon variant="light" color="gray">
                            <IconUsersGroup size={14} />
                          </ThemeIcon>
                          <Text size="sm">
                            {collaboratorCount} {collaboratorCount === 1 ? "collaborator" : "collaborators"}
                          </Text>
                        </Group>
                      </Group>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              No albums yet. Start a new one from Photos when you're ready.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
