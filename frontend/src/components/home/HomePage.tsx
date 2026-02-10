import { useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useComputedColorScheme,
} from "@mantine/core";
import { Background } from "../layout/Background";
import { GlassCard } from "../layout/GlassCard";
import { PageHero } from "../layout/PageHero";
import { MetricTile } from "../layout/MetricTile";
import {
  IconArrowRight,
  IconDeviceMobile,
  IconPhoto,
  IconRadar,
  IconSparkles,
  IconStack2,
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
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(20, 24, 35, 0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)";
  const heroOverlay = isDark
    ? "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
    : "linear-gradient(145deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))";
  const liftShadow = isDark ? "0 18px 60px -40px rgba(0,0,0,0.65)" : "0 18px 60px -40px rgba(15, 23, 42, 0.4)";
  const cardBaseShadow = isDark ? "0 16px 50px -50px rgba(0,0,0,0.65)" : "none";

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
    <Background p={{ base: "md", md: "xl" }} style={{ minHeight: "100%" }}>
      <Stack gap="xl">
        <PageHero
          overlay={heroOverlay}
          badge={null}
          title={
            <Title order={1} size="h2" lh={1.2}>
              Welcome back. Everything is ready for your next drop.
            </Title>
          }
          description={
            <Text c="dimmed" size="sm">
              Curate albums, keep frames aligned, and nudge collaborators—all from a calmer, cleaner cockpit.
            </Text>
          }
          actions={
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
          }
          meta={
            <Group gap="sm" wrap="wrap">
              <Badge variant="light" color="blue">
                {albums.length} albums live
              </Badge>
              <Badge variant="light" color="gray">
                {stats[1].value} photos stored
              </Badge>
              <Badge variant="light" color="teal">
                {totalCollaborators} collaborators
              </Badge>
            </Group>
          }
          aside={null}
        />

        <GlassCard radius="lg" p="lg" shadow={isDark ? "0 22px 80px -70px rgba(0,0,0,0.7)" : "0 22px 80px -60px rgba(15, 23, 42, 0.4)"}>
          <Stack gap="md">
            <Group align="baseline" justify="space-between" wrap="wrap">
              <Title order={3} size="h4">
                Quick links
              </Title>
              <Text size="sm" c="dimmed">
                Drop straight into the flows you use most.
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
                  style={{
                    cursor: "pointer",
                    background: isDark
                      ? "linear-gradient(145deg, rgba(17,24,39,0.95), rgba(26,32,44,0.9))"
                      : "linear-gradient(145deg, rgba(248,251,255,0.9), rgba(238,242,255,0.9))",
                    transition: "transform 120ms ease, box-shadow 160ms ease",
                    boxShadow: cardBaseShadow,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = liftShadow;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = cardBaseShadow;
                  }}
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
        </GlassCard>

        <GlassCard radius="lg" p="lg" shadow={isDark ? "0 18px 70px -70px rgba(0,0,0,0.65)" : "0 18px 70px -60px rgba(15, 23, 42, 0.35)"}>
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
                    <Paper
                      key={album.id}
                      withBorder
                      radius="md"
                      p="md"
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg, rgba(20,24,35,0.94), rgba(15,18,28,0.94))"
                          : "linear-gradient(135deg, rgba(248,251,255,0.96), rgba(238,242,255,0.96))",
                        borderColor: surfaceBorder,
                      }}
                    >
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
        </GlassCard>
      </Stack>
    </Background>
  );
}
