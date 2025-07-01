const mockFrames = [
  {
    name: "Living Room Frame",
    description: "Main frame in the living room displaying family photos.",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "online",
    currentAlbum: "Family Vacation 2024",
    sharedWith: ["alice@example.com", "bob@example.com"],
  },
  {
    name: "Bedroom Frame",
    description: "Cozy frame with relaxing nature scenes. LONGGGGgsuildfhljshdfslfdhlskjdfhsakljdfhyig laisdfhsklhdbf aks iauhefioawe awoeijhf awoiughaiwehfkla sdfhja sduifha lsfj",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "offline",
    currentAlbum: "Nature Walks",
    sharedWith: [],
  },
  {
    name: "Office Frame",
    description: "Frame in the home office, showing work-related photos.",
    activeImage: "https://webcdn.smint.io/media/1534471.jpg",
    status: "offline",
    currentAlbum: "Work Highlights",
    sharedWith: ["carol@example.com"],
  },
];

import { Stack } from "@mantine/core";
import { FrameCover } from "./FramCover";

export function FramesPage() {
  return (
    <Stack gap="md" p="md">
      {mockFrames.map((frame) => (
        <FrameCover key={frame.name} frame={frame} />
      ))}
    </Stack>
  );
}