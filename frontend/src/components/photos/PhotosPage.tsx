import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  Group,
  Paper,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useComputedColorScheme,
} from "@mantine/core";
import { useIsMobile } from "../../util/LayoutUtil";
import { AlbumCover } from "./AlbumCover";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconFilter, IconPhoto, IconPlus, IconSparkles, IconRadar, IconFolder } from "@tabler/icons-react";
import { useAlbumEditor } from "./AlbumEditor";
import { usePhoto } from "../../contexts/PhotoContext";
import { Album } from "../../types/Photos";

export function PhotosPage() {
  const isMobile = useIsMobile();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(20, 24, 35, 0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)";
  const shellBackground = isDark
    ? "radial-gradient(circle at 12% 20%, rgba(52,125,244,0.12), transparent 30%)," +
      "radial-gradient(circle at 82% 10%, rgba(132,94,247,0.14), transparent 26%)," +
      "linear-gradient(145deg, #0f1629 0%, #0b1221 100%)"
    : "radial-gradient(circle at 12% 20%, rgba(52,125,244,0.16), transparent 30%)," +
      "radial-gradient(circle at 82% 10%, rgba(132,94,247,0.12), transparent 26%)," +
      "linear-gradient(145deg, #f8fbff 0%, #eef2ff 100%)";
  const heroOverlay = isDark
    ? "radial-gradient(circle at 30% 30%, rgba(52,125,244,0.15), transparent 32%)," +
      "radial-gradient(circle at 80% 30%, rgba(132,94,247,0.14), transparent 28%)"
    : "radial-gradient(circle at 30% 30%, rgba(52,125,244,0.15), transparent 32%)," +
      "radial-gradient(circle at 80% 30%, rgba(132,94,247,0.12), transparent 28%)";
  const liftShadow = isDark ? "0 18px 60px -40px rgba(0,0,0,0.65)" : "0 18px 60px -40px rgba(15, 23, 42, 0.4)";
  const cardBaseShadow = isDark ? "0 16px 50px -50px rgba(0,0,0,0.65)" : "none";
  const [opened, { toggle, close }] = useDisclosure(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastModified");
  const [sharedOnly, setSharedOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { openEditor } = useAlbumEditor();
  const { createAlbum, saveAlbum, uploadPhoto, albums } = usePhoto();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const containerWidth = container.offsetWidth;
      const baseCardSize = 163 + 16;

      if (containerWidth) {
        const cardsPerRow = Math.floor(containerWidth / baseCardSize);
        if (cardsPerRow > 0) {
          const totalGap = 16 * cardsPerRow;
          const newCardWidth = (containerWidth - totalGap) / cardsPerRow;
          const newScale = newCardWidth / 163;
          setScale(newScale);
        }
      }
    };

    updateScale();

    window.addEventListener("resize", updateScale);

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener("resize", updateScale);
      resizeObserver.disconnect();
    };
  }, []);

  const openForEdit = (album: Album, mode: "existing" | "draft" = "existing") => {
    let draftIdPromise: Promise<string | null> | null = null;

    openEditor(album, async (updated) => {
      if (mode === "draft") {
        if (!draftIdPromise) {
          draftIdPromise = (async () => {
            const creation = await createAlbum();
            if (!creation.success) {
              return null;
            }
            return creation.data.id as string;
          })();
        }

        const resolvedId = await draftIdPromise;
        if (!resolvedId) {
          draftIdPromise = null;
          return updated;
        }

        const stagedPhotos = updated.photos || [];
        const carriedOver = stagedPhotos.filter((photo) => !photo.previewData);
        const uploadedPhotos: Album["photos"] = [...carriedOver];

        for (const photo of stagedPhotos) {
          if (!photo.previewData) continue;
          const response = await uploadPhoto({
            albumId: resolvedId,
            data: photo.previewData,
          });

          if (response.success && response.data?.id) {
            uploadedPhotos.push({ id: response.data.id });
          }
        }

        const persisted: Album = { ...updated, id: resolvedId, photos: uploadedPhotos };
        await saveAlbum(persisted);
        return persisted;
      }

      await saveAlbum(updated);
      return updated;
    });
  };

  const handleNewAlbum = () => {
    const draftAlbum: Album = {
      id: `draft-${Date.now()}`,
      name: "Untitled album",
      photos: [],
      collaborators: [],
    };
    openForEdit(draftAlbum, "draft");
  };

  const totalPhotos = useMemo(
    () => albums.reduce((sum, album) => sum + album.photos.length, 0),
    [albums]
  );

const stats = useMemo(
    () => [
      {
        label: "Albums",
        value: albums.length,
        description: "Curated collections",
        icon: <IconSparkles size={16} />,
      },
      {
        label: "Photos",
        value: totalPhotos,
        description: "Across all albums",
        icon: <IconPhoto size={16} />,
      },
    ],
    [albums.length, totalPhotos]
  );

  const newAlbumSize = 163 * scale;
  
  return (
    <Box
      p={{ base: "md", md: "xl" }}
      style={{ minHeight: "100%", background: shellBackground }}
    >
      <Stack gap="xl">
        <Paper
          radius="xl"
          p="xl"
          withBorder
          style={{
            position: "relative",
            overflow: "hidden",
            background: surface,
            borderColor: surfaceBorder,
            boxShadow: isDark ? "0 30px 120px -70px rgba(0,0,0,0.75)" : "0 30px 120px -60px rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Box
            style={{
              position: "absolute",
              inset: 0,
              background: heroOverlay,
              pointerEvents: "none",
            }}
          />
          <Group align="flex-start" justify="space-between" wrap="wrap" gap="xl" style={{ position: "relative", zIndex: 1 }}>
            <Stack gap="md" maw={620}>
              <Badge variant="light" color="blue" size="lg" radius="md" leftSection={<IconRadar size={16} />}>
                Library
              </Badge>
              <Title order={1} size="h2" lh={1.2}>
                My Albums
              </Title>
              <Text c="dimmed" size="sm">
                Keep your favorite moments organized, invite collaborators, and send the best ones straight to your frames.
              </Text>
              <Group gap="md" wrap="wrap">
                <Button
                  px={12}
                  variant="filled"
                  title="Create Album"
                  onClick={handleNewAlbum}
                  leftSection={<IconPlus size={18} />}
                >
                  New album
                </Button>
                <Button
                  variant="default"
                  leftSection={<IconFilter size={16} />}
                  onClick={toggle}
                >
                  Filters
                </Button>
              </Group>
              <Group gap="sm" wrap="wrap">
                <Badge variant="light" color="blue">
                  {albums.length} albums
                </Badge>
                <Badge variant="light" color="teal">
                  {totalPhotos} photos
                </Badge>
              </Group>
            </Stack>

            <Paper
              withBorder
              radius="lg"
              p="md"
              style={{
                minWidth: 260,
                background: surface,
                borderColor: surfaceBorder,
                boxShadow: isDark ? "0 16px 50px -50px rgba(0,0,0,0.7)" : "0 16px 50px -40px rgba(15, 23, 42, 0.5)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="indigo" radius="xl">
                    <IconFolder size={16} />
                  </ThemeIcon>
                  <Text fw={600}>Library pulse</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Snapshot of what's inside your library.
                </Text>
                {stats.map(({ label, value }) => (
                  <Stack key={label} gap={6}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {label}
                      </Text>
                      <Text size="xs" fw={600}>
                        {value}
                      </Text>
                    </Group>
                    <Divider opacity={0.1} />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Group>
        </Paper>

        <Paper
          withBorder
          radius="lg"
          p="lg"
          style={{
            background: surface,
            borderColor: surfaceBorder,
            boxShadow: isDark ? "0 22px 80px -70px rgba(0,0,0,0.7)" : "0 22px 80px -60px rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Stack gap="md">
            <Group align="baseline" justify="space-between" wrap="wrap">
              <Title order={3} size="h4">
                Overview
              </Title>
              <Text size="sm" c="dimmed">
                Quick stats for your albums.
              </Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {stats.map(({ label, value, description, icon }) => (
                <Paper
                  key={label}
                  radius="md"
                  withBorder
                  p="md"
                  style={{
                    background:
                      label === "Albums"
                        ? isDark
                          ? "linear-gradient(145deg, rgba(52,125,244,0.18), rgba(20,24,35,0.9))"
                          : "linear-gradient(145deg, rgba(52,125,244,0.12), #fff)"
                        : surface,
                    borderColor: surfaceBorder,
                  }}
                >
                  <Stack gap={6}>
                    <Group gap="xs">
                      <ThemeIcon variant="light" color="blue" size="sm">
                        {icon}
                      </ThemeIcon>
                      <Text fw={600}>{label}</Text>
                    </Group>
                    <Text fw={600} size="xl">
                      {value}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {description}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="md" style={{ background: surface, borderColor: surfaceBorder, boxShadow: cardBaseShadow }}>
          <Box
            ref={containerRef}
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: "100%",
              margin: -8,
            }}
          >
            {albums.map((album) => (
              <Box
                key={album.id}
                style={{
                  width: 163 * scale,
                  height: 163 * scale,
                  margin: 8,
                }}
                onClick={() => openForEdit(album)}
              >
                <AlbumCover album={album} size={163 * scale} />
              </Box>
            ))}

            <Paper
              withBorder
              radius="md"
              style={{
                height: newAlbumSize,
                width: newAlbumSize,
                margin: 8,
                borderStyle: "dashed",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
              }}
              onClick={handleNewAlbum}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleNewAlbum();
                }
              }}
            >
              <ThemeIcon size="xl" variant="light" radius="xl">
                <IconPlus size={20} />
              </ThemeIcon>
              <Stack gap={0} align="center">
                <Text fw={600}>New album</Text>
                <Text size="xs" c="dimmed">
                  Start from scratch
                </Text>
              </Stack>
            </Paper>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}
