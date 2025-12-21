import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Center,
  Chip,
  Container,
  Group,
  Modal,
  Slider,
  Text,
  Button,
  Loader,
  Stack
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { usePhoto } from '../../contexts/PhotoContext';
import { Album, Photo } from '../../types/Photos';
import { getApiBase } from '../../util/UrlUtil';

type Orientation = 'horizontal' | 'vertical';
const PREVIEW_SCALE = 0.5;
const MOBILE_PREVIEW_SCALE = 0.36;
const FRAME_BORDER_WIDTH = 18;
const MAT_BORDER_WIDTH = 12;
const EDITOR_MODAL_Z_INDEX = 2200;

interface PhotoEditorProps {
    album: Album,
    image: string;
    close: () => void;
    addPhoto: (photo: Photo) => void;
}

export function PhotoEditor({ album, image, close, addPhoto }: PhotoEditorProps) {
  const { uploadPhoto } = usePhoto();
    const isMobile = useMediaQuery('(max-width: 48em)');
    const previewScale = isMobile ? MOBILE_PREVIEW_SCALE : PREVIEW_SCALE;
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [imageScale, setImageScale] = useState(1);
    const [baseScale, setBaseScale] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const imageIdentityRef = useRef<string | null>(null);
    const isDraftAlbum = album.id.startsWith("draft-");
    const dragStateRef = useRef({
    pointerId: null as null | number,
    startX: 0,
    startY: 0,
    originX: 0,
        originY: 0,
    });
    const normalizedImage = useMemo(() => {
        if (!image) return "";
        if (image.startsWith("data:") || image.startsWith("blob:") || image.startsWith("http")) {
            return image;
        }
        return `data:image/png;base64,${image}`;
    }, [image]);

  const dimensions = useMemo(() => {
    const isHorizontal = orientation === 'horizontal';
    const canvasWidth = isHorizontal ? 600 : 448;
    const canvasHeight = isHorizontal ? 448 : 600;

    return {
      canvasWidth,
      canvasHeight,
      previewWidth: canvasWidth * previewScale,
      previewHeight: canvasHeight * previewScale,
    };
  }, [orientation, previewScale]);

  const frameExterior = useMemo(() => ({
    width: dimensions.previewWidth + MAT_BORDER_WIDTH * 2,
    height: dimensions.previewHeight + MAT_BORDER_WIDTH * 2,
  }), [dimensions]);

    useEffect(() => {
        const img = new Image();
        img.src = normalizedImage;
        img.onload = () => setImageSize({ width: img.width, height: img.height });
    }, [normalizedImage]);

  const clampPosition = useCallback((position: { x: number; y: number }, scale = imageScale) => {
    if (!imageSize.width || !imageSize.height) return position;

    const scaledWidth = imageSize.width * scale;
    const scaledHeight = imageSize.height * scale;

    const maxX = Math.abs(dimensions.previewWidth - scaledWidth) / 2;
    const maxY = Math.abs(dimensions.previewHeight - scaledHeight) / 2;

    const clampedX = Math.min(Math.max(position.x, -maxX), maxX);
    const clampedY = Math.min(Math.max(position.y, -maxY), maxY);

    return { x: clampedX, y: clampedY };
  }, [imageSize, dimensions.previewWidth, dimensions.previewHeight, imageScale]);

    useEffect(() => {
        if (!imageSize.width || !imageSize.height) return;
        const { previewWidth, previewHeight } = dimensions;
        if (!previewWidth || !previewHeight) return;

        const containScale = Math.min(
            previewWidth / imageSize.width,
            previewHeight / imageSize.height
        );

        if (!isFinite(containScale) || containScale <= 0) return;

        const isNewImage = imageIdentityRef.current !== normalizedImage;
        const zoomMultiplier = zoomPercent / 100;
        const nextScale = containScale * zoomMultiplier;

        setBaseScale(containScale);
        setImageScale(isNewImage ? containScale : nextScale);

        if (isNewImage) {
            setZoomPercent(100);
            setImagePosition({ x: 0, y: 0 });
        } else {
            setImagePosition((prev) => clampPosition(prev, nextScale));
        }

        imageIdentityRef.current = normalizedImage;
    }, [normalizedImage, imageSize, dimensions, zoomPercent, clampPosition]);

  useEffect(() => {
    setImagePosition((prev) => {
      const next = clampPosition(prev);
      if (next.x === prev.x && next.y === prev.y) return prev;
      return next;
    });
  }, [clampPosition]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: imagePosition.x,
      originY: imagePosition.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const activePointerId = dragStateRef.current.pointerId;
    if (activePointerId === null || activePointerId !== event.pointerId) return;

    const dx = event.clientX - dragStateRef.current.startX;
    const dy = event.clientY - dragStateRef.current.startY;

    setImagePosition((prev) => {
      const next = {
        x: dragStateRef.current.originX + dx,
        y: dragStateRef.current.originY + dy,
      };
      return clampPosition(next);
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== event.pointerId) return;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current.pointerId = null;
  };

  const handleOrientationChange = (nextValue: string | null) => {
    if (!nextValue) return;
    setOrientation(nextValue as Orientation);
  };

  const resetEditor = () => {
    setZoomPercent(100);
    setImageScale(baseScale);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomChange = (val: number) => {
    setZoomPercent(val);
    const nextScale = baseScale * (val / 100);
    setImageScale(nextScale);
    setImagePosition((prev) => clampPosition(prev, nextScale));
  };


  const add = async () => {
    setLoading(true);

    const data = await generateImageData();

        if (isDraftAlbum) {
            addPhoto({
                id: `local-${Date.now()}`,
                previewData: data as string,
            });
      setLoading(false);
      close();
      return;
    }

        uploadPhoto({
            albumId: album.id,
            data: data as string
        }).then(res => {
            if (res.success && res.data?.id) {
                const photoId = res.data.id as string;
                addPhoto({
                    id: photoId,
                    url: `${getApiBase()}api/photo/get/${photoId}.png`,
                });
            }
            setLoading(false);
            close();
        }).catch(() => {
            setLoading(false);
    });
  };

  const generateImageData = () => {
        return new Promise((resolve, reject) => {
            if (!normalizedImage || !canvasRef.current) return reject('No image or canvas reference');
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Could not get canvas context');

            const img = new Image();
            img.src = normalizedImage;

      img.onload = () => {
        canvas.width = dimensions.canvasWidth;
        canvas.height = dimensions.canvasHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

                const offsetMultiplier = dimensions.canvasWidth / dimensions.previewWidth;
                const scaledWidth = img.width * imageScale * offsetMultiplier;
                const scaledHeight = img.height * imageScale * offsetMultiplier;
                // Preview translations are applied before scale in CSS (translate then scale), so keep raw offsets.
                const canvasOffsetX = imagePosition.x * offsetMultiplier;
                const canvasOffsetY = imagePosition.y * offsetMultiplier;

                const drawX = (canvas.width - scaledWidth) / 2 + canvasOffsetX;
                const drawY = (canvas.height - scaledHeight) / 2 + canvasOffsetY;

        ctx.drawImage(
          img,
          drawX,
          drawY,
          scaledWidth,
          scaledHeight
        );

        const base64 = canvas.toDataURL('image/png');
        resolve(base64);
      };

      img.onerror = reject;
    });
  };

  const framedPreview = (
    <div
      style={{
        width: frameExterior.width,
        maxWidth: '100%',
        height: frameExterior.height,
        padding: FRAME_BORDER_WIDTH,
        borderRadius: 36,
        background: 'linear-gradient(135deg, #c58c4a 15%, #8b5a2b 85%)',
        boxShadow: orientation === 'vertical'
          ? '0 20px 36px rgba(139, 90, 43, 0.45)'
          : '0 16px 28px rgba(139, 90, 43, 0.30)',
        boxSizing: 'content-box',
        transition: 'width 240ms ease, height 240ms ease, transform 260ms ease, box-shadow 260ms ease',
        transform: 'scale(1)',
      }}
    >
      <div
        style={{
          padding: MAT_BORDER_WIDTH,
          borderRadius: 28,
          background: 'linear-gradient(145deg, #fdf8f0, #f4ece1)',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: dimensions.previewWidth,
            height: dimensions.previewHeight,
            overflow: 'hidden',
            borderRadius: 20,
            backgroundColor: 'var(--mantine-color-gray-1)',
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            transition: 'width 240ms ease, height 240ms ease',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
                    <img
                        src={normalizedImage || undefined}
                        alt=""
                        aria-label="Photo preview"
                        draggable={false}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
              transform: `translate(-50%, -50%) translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
              transformOrigin: 'center',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );

  const sliderWidth = isMobile ? '100%' : 320;
  const orientationWidth = isMobile ? '100%' : undefined;

  const controls = (
    <>
      <Stack gap={2} align="center">
        <Text size="sm" c="dimmed" ta="center">
                    Drag inside the frame to reposition.
        </Text>
        <Text size="sm" c="dimmed" ta="center">
                    Use zoom to fill the frame exactly how you like.
        </Text>
      </Stack>

      <Container mt="sm" mb="sm" w={sliderWidth}>
        <Group justify="space-between" mb={6}>
          <Text fw={500}>Zoom</Text>
          <Button variant="subtle" size="xs" onClick={resetEditor} disabled={loading}>
                        Reset
          </Button>
        </Group>
        <Slider
          min={50}
          max={200}
          value={zoomPercent}
          onChange={handleZoomChange}
          marks={[
            { value: 50, label: '50%' },
            { value: 100, label: '100%' },
            { value: 150, label: '150%' },
          ]}
        />
      </Container>

      <Container w={orientationWidth}>
        <Text fw={500} mb={6}>Orientation</Text>
        <Chip.Group multiple={false} value={orientation} onChange={handleOrientationChange}>
          <Group>
            <Chip value="horizontal">Horizontal</Chip>
            <Chip value="vertical">Vertical</Chip>
          </Group>
        </Chip.Group>
      </Container>

      <Group
        gap="sm"
        grow
        mt="md"
        w="100%"
        style={{
          marginTop: isMobile ? 'auto' : undefined,
          paddingBottom: isMobile ? '0.75rem' : undefined,
        }}
      >
        <Button variant="light" color="gray" onClick={close} disabled={loading}>
                    Cancel
        </Button>
        <Button color="blue" onClick={add} disabled={loading}>
                    Add Photo
        </Button>
      </Group>
    </>
  );

  const modalBody = isMobile ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--mantine-color-body)',
      }}
    >
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {framedPreview}
      </div>
      <Stack gap="sm" style={{ padding: '1rem' }}>
        {controls}
      </Stack>
    </div>
  ) : (
    <Stack gap="md">
      <Center>
        {framedPreview}
      </Center>
      {controls}
    </Stack>
  );

  return (
    <>
      {loading && (
        <Center
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255,255,255,0.6)',
            zIndex: 9999,
          }}
        >
          <Loader size="lg" />
        </Center>
      )}

      <Modal
        radius="lg"
        size={isMobile ? '100%' : 'md'}
        fullScreen={isMobile}
        withCloseButton={false}
        opened
        onClose={() => { }}
        centered={!isMobile}
        padding={isMobile ? 0 : 'md'}
        zIndex={EDITOR_MODAL_Z_INDEX}
        overlayProps={{ opacity: 0.55, blur: 4 }}
      >
        {modalBody}
      </Modal>
      <canvas ref={canvasRef} hidden />
    </>
  );
}
