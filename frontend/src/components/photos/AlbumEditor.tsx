import { Box, Modal, Stack, TextInput, Text, Button, Group, Checkbox, Avatar, Badge, ActionIcon, ScrollArea, Drawer, Paper, SimpleGrid, useComputedColorScheme } from "@mantine/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Album, Collaborator } from "../../types/Photos";
import { IconTrash, IconPhotoPlus, IconCheck, IconX } from "@tabler/icons-react";
import { useIsMobile } from "../../util/LayoutUtil";
import {  usePhotoUploader } from "./PhotoUploader";
import { getUrlFromPhoto } from "../../util/UrlUtil";
import { usePhoto } from "../../contexts/PhotoContext";
import { BackgroundModal } from "../layout/BackgroundModal";

type AlbumEditorProps = {
  opened: boolean;
  album: Album;
  onSave: (album: Album, options?: { close?: boolean }) => Promise<Album | void> | Album | void;
  onDismiss: () => void;
};

export function AlbumEditor({ opened, album, onSave, onDismiss }: AlbumEditorProps) {
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const [name, setName] = useState(album.name || "Untitled album");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(album.collaborators || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [photos, setPhotos] = useState(album.photos || []);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [albumDeleteConfirmOpen, setAlbumDeleteConfirmOpen] = useState(false);
  const [cancelDraftConfirmOpen, setCancelDraftConfirmOpen] = useState(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSaveRef = useRef(true);
  const hasPendingChangesRef = useRef(false);
  const { openUploader } = usePhotoUploader();
  const { deleteAlbum, deletePhotos } = usePhoto();
  const markDirty = useCallback(() => {
    hasPendingChangesRef.current = true;
  }, []);

  const showCollaborators = false;

  const isMobile = useIsMobile();
  const isDraft = useMemo(() => album.id.startsWith("draft-"), [album.id]);

  const surface = isDark ? "rgba(20,24,35,0.9)" : "rgba(255,255,255,0.92)";
  const surfaceBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.12)";
  const liftShadow = isDark ? "0 18px 60px -45px rgba(0,0,0,0.7)" : "0 18px 60px -40px rgba(15,23,42,0.28)";

  const modalSurfaceStyles = {
    content: {
      background: surface,
      border: `1px solid ${surfaceBorder}`,
      boxShadow: liftShadow,
    },
    body: { background: "transparent" },
    header: { background: "transparent" },
  } as const;

  const sectionSurfaceStyle = {
    background: surface,
    borderColor: surfaceBorder,
    boxShadow: liftShadow,
  } as const;

  useEffect(() => {
    setName(album.name || "Untitled album");
    setCollaborators(album.collaborators ? [...album.collaborators] : []);
    setInviteEmail("");
    setPhotos(album.photos ? [...album.photos] : []);
    setSelectedPhotoIds(new Set());
    skipNextSaveRef.current = true;
    hasPendingChangesRef.current = false;
  }, [album.id, album.photos]);

  const handleRemove = (email: string) => {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
    markDirty();
  };

  const handleCollaboratorChange = (index: number, update: Partial<Collaborator>) => {
    setCollaborators((prev) =>
      prev.map((collab, i) => (i === index ? { ...collab, ...update } : collab))
    );
    markDirty();
  };

  const handleInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || collaborators.some((c) => c.email === email)) return;
    setCollaborators((prev) => [
      ...prev,
      { email, editor: false, status: "invited" },
    ]);
    setInviteEmail("");
    markDirty();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    markDirty();
  };

  const handleCancelDraft = () => {
    if (photos.length > 0) {
      setCancelDraftConfirmOpen(true);
      return;
    }
    onDismiss();
  };

  const handleUploadPicture = () => {
    openUploader(album, (photo) => {
      setPhotos((prev) => [...prev, photo]);
      markDirty();
    });
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedPhotoIds(new Set());

  const requestDeleteSelectedPhotos = () => {
    if (selectedPhotoIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteSelectedPhotos = async () => {
    if (selectedPhotoIds.size === 0) {
      setDeleteConfirmOpen(false);
      return;
    }

    const idsToDelete = Array.from(selectedPhotoIds);
    setDeleteConfirmOpen(false);
    setSelectedPhotoIds(new Set());

    if (isDraft) {
      setPhotos((prev) => prev.filter((photo) => !selectedPhotoIds.has(photo.id)));
      markDirty();
      return;
    }

    const res = await deletePhotos(idsToDelete);
    if (res.success) {
      setPhotos((prev) => prev.filter((photo) => !idsToDelete.includes(photo.id)));
      markDirty();
    }
  };

  const buildAlbumPayload = useCallback((): Album => ({
    id: album.id,
    name: name.trim() || "Untitled album",
    collaborators,
    photos,
  }), [album.id, collaborators, name, photos]);

  useEffect(() => {
    if (isDraft) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const maybePromise = onSave(buildAlbumPayload());
      if (maybePromise && typeof (maybePromise as Promise<Album | void>).then === "function") {
        (maybePromise as Promise<Album | void>).catch((error) => {
          console.error("Album autosave failed", error);
        });
      }
      hasPendingChangesRef.current = false;
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }
    }, 600);

    autosaveTimeoutRef.current = timeoutId;

    return () => {
      clearTimeout(timeoutId);
      if (autosaveTimeoutRef.current === timeoutId) {
        autosaveTimeoutRef.current = null;
      }
    };
  }, [buildAlbumPayload, onSave, isDraft]);

  const handleClose = () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (isDraft) {
      hasPendingChangesRef.current = false;
      onDismiss();
      return;
    }
    if (hasPendingChangesRef.current) {
      hasPendingChangesRef.current = false;
      const maybePromise = onSave(buildAlbumPayload(), { close: true });
      if (maybePromise && typeof (maybePromise as Promise<Album | void>).then === "function") {
        (maybePromise as Promise<Album | void>).catch((error) => {
          console.error("Album save on close failed", error);
        });
      }
    } else {
      onDismiss();
    }
  };

  const handleCreateDraft = () => {
    if (!isDraft || isCreatingDraft) return;
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    setIsCreatingDraft(true);
    const payload = buildAlbumPayload();
    let maybePromise: Promise<Album | void> | Album | void;
    try {
      maybePromise = onSave(payload);
    } catch (error) {
      console.error("Album creation failed", error);
      setIsCreatingDraft(false);
      return;
    }

    const complete = (result?: Album | void) => {
      const nextId = result?.id ?? album.id;
      const success = typeof nextId === "string" ? !nextId.startsWith("draft-") : false;
      if (success) {
        hasPendingChangesRef.current = false;
        onDismiss();
      } else {
        hasPendingChangesRef.current = true;
      }
      setIsCreatingDraft(false);
    };

    if (maybePromise && typeof (maybePromise as Promise<Album | void>).then === "function") {
      (maybePromise as Promise<Album | void>)
        .then((result) => complete(result))
        .catch((error) => {
          console.error("Album creation failed", error);
          complete();
        });
    } else {
      complete(maybePromise as Album | void);
    }
  };

  const handleAlbumDelete = async () => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    setAlbumDeleteConfirmOpen(false);
    hasPendingChangesRef.current = false;

    if (isDraft) {
      onDismiss();
      return;
    }

    const res = await deleteAlbum(album.id);
    if (!res.success) {
      return;
    }

    onDismiss();
  };

  const photoCount = photos.length;
  const selectedCount = selectedPhotoIds.size;
  const hasSelection = selectedCount > 0;
  const creationLocked = isDraft && isCreatingDraft;

  const heroImage =
    photos.length > 0
      ? getUrlFromPhoto(photos[0])
      : "https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=800&q=80";

  const collaboratorSection =
    collaborators.length === 0 ? (
      <Text c="dimmed" size="sm">
        Nobody has access yet. Invite collaborators to share this album.
      </Text>
    ) : (
      <ScrollArea
        mah={180}
        scrollbarSize={6}
        scrollHideDelay={0}
        styles={(theme) => ({
          scrollbar: {
            background: "transparent",
          },
          thumb: {
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            borderRadius: 12,
            border: "2px solid transparent",
          },
          corner: {
            backgroundColor: "transparent",
          },
          viewport: {
            // Firefox fallback
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0, 0, 0, 0.25) transparent",
          },
        })}
      >
        <Stack gap="sm">
          {collaborators.map((c, i) => (
            <Group key={c.email} justify="space-between" gap="sm" align="center">
              <Group gap="sm">
                <Avatar radius="xl" size="md" color="gray">
                  {c.email[0]?.toUpperCase()}
                </Avatar>
                <Stack gap={2}>
                  <Text size="sm" fw={500}>{c.email}</Text>
                  <Badge
                    variant="light"
                    size="xs"
                    color={
                      c.status === "accepted"
                        ? "green"
                        : c.status === "invited"
                          ? "blue"
                          : "gray"
                    }
                  >
                    {c.status}
                  </Badge>
                </Stack>
              </Group>
              <Group gap="xs">
                <Checkbox
                  label="Editor"
                  checked={c.editor}
                  disabled={creationLocked}
                  onChange={(e) =>
                    handleCollaboratorChange(i, { editor: e.currentTarget.checked })
                  }
                />
                <ActionIcon
                  variant="light"
                  color="red"
                  disabled={creationLocked}
                  onClick={() => handleRemove(c.email)}
                  aria-label={`Remove ${c.email}`}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      </ScrollArea>
    );

  const photosGrid =
    photos.length > 0 ? (
      <SimpleGrid cols={isMobile ? 2 : 4} spacing="sm">
        {photos.map((photo, idx) => {
          const photoId = photo.id ?? String(idx);
          const isSelected = selectedPhotoIds.has(photoId);
          return (
            <Box
              key={photoId}
              aria-pressed={isSelected}
              component="button"
              type="button"
              onClick={() => togglePhotoSelection(photoId)}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                paddingBottom: "100%",
                backgroundImage: `url(${getUrlFromPhoto(photo)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                cursor: "pointer",
                boxShadow: isSelected
                  ? "0 0 0 3px rgba(96,165,250,0.9), 0 12px 32px rgba(0,0,0,0.28)"
                  : liftShadow,
                outline: "none",
                border: `1px solid ${isSelected ? "rgba(96,165,250,0.9)" : surfaceBorder}`,
                backgroundColor: "transparent",
              }}
            >
              {isSelected && (
                <Box
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(96, 165, 250, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                  }}
                >
                  <IconCheck size={32} />
                </Box>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
    ) : (
      <Paper withBorder radius="md" p="lg" ta="center" style={sectionSurfaceStyle}>
        <Text fw={500}>No photos yet</Text>
        <Text size="sm" c="dimmed">
          Upload your first photo to preview the frame layout.
        </Text>
      </Paper>
    );

  const renderAddPhotoButton = () => (
    <Button
      leftSection={<IconPhotoPlus size={16} />}
      variant="light"
      onClick={handleUploadPicture}
    >
      Add photo
    </Button>
  );

  const Content = (
    <>
      <Stack gap="lg" style={{ padding: isMobile ? "1rem" : "1.5rem", minHeight: isMobile ? "100%" : 500 }}>
        <Box
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 200,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.8) 100%)",
            }}
          />
          <Group
            gap="xs"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 102,
            }}
          >
            <ActionIcon
              variant="subtle"
              aria-label="Close editor"
              onClick={handleClose}
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                color: "white",
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <Stack
            gap="xs"
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
              color: "white",
            }}
          >
            <Text size="xs" c="gray.2">
              {photoCount} photo{photoCount === 1 ? "" : "s"}
            </Text>
            <Text fw={600} size="xl">
              {name || "Untitled album"}
            </Text>
            <Group gap="sm">
              {isDraft && (
                <>
                  <Button
                    onClick={handleCreateDraft}
                    loading={isCreatingDraft}
                    disabled={creationLocked}
                  >
                    Create album
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid rgba(255,0,0,0.3)",
                    }}
                    onClick={handleCancelDraft}
                    disabled={creationLocked}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {renderAddPhotoButton()}
              {!isDraft && (
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setAlbumDeleteConfirmOpen(true)}
                  disabled={creationLocked}
                >
                  Delete album
                </Button>
              )}
            </Group>
          </Stack>
        </Box>

        <Paper withBorder radius="lg" p="md" style={sectionSurfaceStyle}>
          <Stack gap="xs">
            <TextInput
              label="Album name"
              placeholder="Give your album a title"
              value={name}
              disabled={creationLocked}
              onChange={(e) => handleNameChange(e.currentTarget.value)}
              variant="filled"
              styles={{
                input: {
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
                  borderColor: isDark ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)",
                },
                label: { color: isDark ? "var(--mantine-color-gray-3)" : "var(--mantine-color-dark-5)" },
              }}
            />
            <Text size="xs" c="dimmed">
              Friendly titles help you find the right set when sending photos to a frame.
            </Text>
          </Stack>
        </Paper>

        {showCollaborators && (
          <Paper withBorder radius="lg" p="md" style={sectionSurfaceStyle}>
            <Stack gap="sm">
              <Group align="flex-end" gap="sm">
                <TextInput
                  label="Invite collaborators"
                  placeholder="name@email.com"
                  value={inviteEmail}
                  disabled={creationLocked}
                  onChange={(e) => setInviteEmail(e.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleInvite();
                    }
                  }}
                  style={{ flex: 1 }}
                  variant="filled"
                  styles={{
                    input: {
                      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
                      borderColor: isDark ? "var(--mantine-color-dark-4)" : "var(--mantine-color-gray-3)",
                    },
                    label: { color: isDark ? "var(--mantine-color-gray-3)" : "var(--mantine-color-dark-5)" },
                  }}
                />
                <Button onClick={handleInvite} disabled={creationLocked}>
                  Invite
                </Button>
              </Group>
              {collaboratorSection}
            </Stack>
          </Paper>
        )}

        <Paper withBorder radius="lg" p="md" style={sectionSurfaceStyle}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>Photos</Text>
              <Group gap="xs">
                {hasSelection && (
                  <>
                    <Button variant="subtle" size="xs" onClick={clearSelection}>
                      Clear selection
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      onClick={requestDeleteSelectedPhotos}
                    >
                      Delete selected ({selectedCount})
                    </Button>
                  </>
                )}
                {renderAddPhotoButton()}
              </Group>
            </Group>
            {photos.length > 0 && (
              <Text size="xs" c="dimmed">
                Tap photos to select the ones you want to delete.
              </Text>
            )}
            {photosGrid}
          </Stack>
        </Paper>
      </Stack>

    </>
  );

  const deleteConfirmModal = (
    <Modal
      opened={deleteConfirmOpen}
      onClose={() => setDeleteConfirmOpen(false)}
      title="Delete selected photos?"
      centered
      size="sm"
      zIndex={2000}
      styles={modalSurfaceStyles}
    >
      <Stack gap="md">
        <Text>
          You are about to permanently delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}. This cannot be undone. Are you sure you want to continue?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteSelectedPhotos}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  const cancelDraftConfirmModal = (
    <Modal
      opened={cancelDraftConfirmOpen}
      onClose={() => setCancelDraftConfirmOpen(false)}
      title="Discard this draft?"
      centered
      size="sm"
      zIndex={2000}
      styles={modalSurfaceStyles}
    >
      <Stack gap="md">
        <Text>
          You have added photos to this draft. If you cancel now, your unsaved photos will be discarded. Are you sure you want to continue?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setCancelDraftConfirmOpen(false)}>
            Keep editing
          </Button>
          <Button color="red" onClick={() => { setCancelDraftConfirmOpen(false); onDismiss(); }}>
            Discard draft
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  const deleteAlbumConfirmModal = (
    <Modal
      opened={albumDeleteConfirmOpen}
      onClose={() => setAlbumDeleteConfirmOpen(false)}
      title="Delete this album?"
      centered
      size="sm"
      zIndex={2000}
      styles={modalSurfaceStyles}
    >
      <Stack gap="md">
        <Text>
          {isDraft
            ? "This album hasn’t been saved yet. Deleting it will discard all your changes."
            : "Deleting this album removes it and all associated photos from your library. This cannot be undone."}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setAlbumDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={handleAlbumDelete}>
            Delete album
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  if (isMobile) {
    // Render a fullscreen Drawer or a simple fullscreen Box
    return (
      <>
        <Drawer
          opened={opened}
          onClose={handleClose}
          size="100%"
          position="right"
          withCloseButton={false}
          zIndex={1000}
          overlayProps={{ blur: 4 }}
          styles={modalSurfaceStyles}
          padding={0}
        >
          {Content}
        </Drawer>
        {deleteConfirmModal}
        {deleteAlbumConfirmModal}
        {cancelDraftConfirmModal}
      </>
    );
  }

  return (
    <>
      <BackgroundModal
        opened={opened}
        onClose={handleClose}
        size="lg"
        radius="lg"
        centered
        padding={0}
        withCloseButton={false}
        innerPadding={0}
      >
        {Content}
      </BackgroundModal>
      {deleteConfirmModal}
      {deleteAlbumConfirmModal}
      {cancelDraftConfirmModal}
    </>
  );
}


type AlbumEditorContextType = {
  openEditor: (album: Album, onSave?: (updated: Album) => Album | void | Promise<Album | void>) => void;
};

const AlbumEditorContext = createContext<AlbumEditorContextType | undefined>(undefined);

export function useAlbumEditor() {
  const ctx = useContext(AlbumEditorContext);
  if (!ctx) throw new Error("useAlbumEditor must be used within AlbumEditorProvider");
  return ctx;
}

export function AlbumEditorProvider({ children }: { children: React.ReactNode }) {
  const { albums } = usePhoto();
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [onSave, setOnSave] = useState<((a: Album) => Album | void | Promise<Album | void>) | undefined>();
  const [stagedAlbum, setStagedAlbum] = useState<Album | null>(null);

  const openEditor = useCallback((album: Album, onSaveCallback?: (a: Album) => Album | void | Promise<Album | void>) => {
    setAlbumId(album.id);
    setStagedAlbum(album);
    setOnSave(() => onSaveCallback);
    setOpened(true);
  }, []);

  const closeEditor = useCallback(() => {
    setOpened(false);
    setAlbumId(null);
    setStagedAlbum(null);
    setOnSave(undefined);
  }, []);

  const persistAlbum = useCallback((updated: Album, options?: { close?: boolean }) => {
    const executeSave = () => {
      const maybeResult = onSave?.(updated);

      const finalize = (next?: Album) => {
        const normalized = next ?? updated;
        setStagedAlbum(normalized);
        setAlbumId(normalized.id);
        if (options?.close) {
          closeEditor();
        }
        return normalized;
      };

      if (maybeResult && typeof (maybeResult as Promise<Album | void>).then === "function") {
        return (maybeResult as Promise<Album | void>)
          .then((value) => finalize(value))
          .catch((error) => {
            console.error("Album save failed", error);
            throw error;
          });
      }

      return Promise.resolve(finalize(maybeResult as Album | void));
    };

    try {
      return executeSave();
    } catch (error) {
      console.error("Album save failed", error);
      return Promise.reject(error);
    }
  }, [closeEditor, onSave]);

  const liveAlbum = albumId ? albums.find(a => a.id === albumId) : null;
  const album = liveAlbum ?? stagedAlbum;

  return (
    <AlbumEditorContext.Provider value={{ openEditor }}>
      {children}
      {album && (
        <AlbumEditor
          album={album}
          opened={opened}
          onDismiss={closeEditor}
          onSave={persistAlbum}
        />
      )}
    </AlbumEditorContext.Provider>
  );
}
