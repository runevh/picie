import { Box, Image, Text, Overlay, Transition } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { Album } from "../../types/Photos";

type AlbumCoverProps = {
  album: Album;
  size?: number; // optional square size (px)
};

export function AlbumCover({ album, size = 163 }: AlbumCoverProps) {
  const [hovered, setHovered] = useState(false);
  const [descHeight, setDescHeight] = useState(0);
  const descRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hovered && descRef.current) {
      setDescHeight(descRef.current.offsetHeight);
    }
  }, [hovered]);

  const renderPhotos = () => {
    if (album.photos.length === 1) {
      return (
        <Image
          src={album.photos[0]}
          alt={album.title}
          fit="cover"
          height={size}
          width={size}
          radius="md"
        />
      );
    }

    const photosToShow = album.photos.slice(0, 4);
    return (
      <Box
        w={size}
        h={size}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {photosToShow.map((photo, index) => (
          <Image
            key={index}
            src={photo}
            alt={`${album.title} ${index + 1}`}
            width="100%"
            height="100%"
            fit="cover"
          />
        ))}
      </Box>
    );
  };

  return (
    <Box
      w={size}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", cursor: "pointer" }}
    >
      {renderPhotos()}

      <Overlay
        opacity={0.6}
        gradient="linear-gradient(0deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)"
        style={{
          borderRadius: 8,
          transition: "opacity 200ms ease",
          opacity: hovered ? 0.6 : 0.3,
        }}
        zIndex={50}
      />

      <Box
        pos="absolute"
        left={0}
        right={0}
        px="sm"
        style={{
          color: "white",
          bottom: hovered ? 14 + descHeight : 10,
          transition: "bottom 300ms ease",
          zIndex: 51,
        }}
      >
        <Text fw={500} size="md" lineClamp={2}>
          {album.title}
        </Text>
      </Box>

      <Box
        pos="absolute"
        bottom={0}
        p="sm"
        style={{
          color: "white",
          width: "100%",
          overflow: "hidden",
          transition: "max-height 200ms ease",
          zIndex: 51
        }}
        ref={descRef}
      >
        <Transition mounted={hovered} transition="fade" duration={150} timingFunction="ease">
          {(styles) => (
            <Text size="xs" style={styles} lineClamp={3}>
              "Placeholder"
            </Text>
          )}
        </Transition>
      </Box>

      {/* Hidden description used for measuring height */}
      <Box
        ref={descRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
          width: size - 32, // accounting for horizontal padding
          padding: 0,
        }}
      >
        <Text size="xs" lineClamp={3}>
          "Placeholder"
        </Text>
      </Box>
    </Box>
  );
}
