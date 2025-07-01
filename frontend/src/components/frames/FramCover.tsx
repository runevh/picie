import { Paper, Image, Stack, Group, Text, Tooltip, Badge, Box } from "@mantine/core";
import { Frame } from "./Frame.types";
import { IconCheck, IconUsers, IconWifi, IconWifiOff, IconX } from "@tabler/icons-react";

type FrameCoverProps = {
  frame: Frame;
  size?: number; // square image size
};

export function FrameCover({ frame, size = 100 }: FrameCoverProps) {
  const statusIcon =
    frame.status === "online" ? (
      <IconWifi size={18} color="green" />
    ) : (
      <IconWifiOff size={18} color="red" />
    );
    
  return (
    <Paper
      shadow="sm"
      radius="md"
      maw={500}
      mah={size}
      style={{ display: "flex", alignItems: "center", gap: 16}}
      pos={"relative"}
    >
      <Box bg={"gray.2"} style={{ width: size, height: size, flexShrink: 0, position: "relative" }}>
        <Image
          src={frame.activeImage}
          alt={`Active image of ${frame.name}`}
          width={size}
          height={size}
          style={{ objectFit: "cover", borderRadius: 8 }}
        />
      </Box>


      <Stack gap={4}
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          flexWrap: "nowrap",
          justifyContent: "space-between",
        }}>
        <Group
          style={{
            justifyContent: "space-between",
            width: "100%",
            flexWrap: "nowrap", // prevent wrapping
          }}
        >
          {statusIcon}
          <Text
            ml={-10}
            fw={500}
            size="md"
            lineClamp={1}
            style={{ flexGrow: 1, minWidth: 0, marginRight: 12, overflow: "hidden" }}
          >
            {frame.name}
          </Text>

          {frame.sharedWith && frame.sharedWith.length > 0 && (
            <Tooltip label={`Shared with ${frame.sharedWith.join(", ")}`}>
              <Badge
                h={24}
                mr={14}
                variant="light"
                color="blue"
                style={{
                  cursor: "default",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 24,       // fix height (adjust as needed)
                  lineHeight: 1,
                  padding: 7,
                }}
              >
                <IconUsers size={16} />
              </Badge>
            </Tooltip>
          )}
        </Group>


        {frame.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {frame.description}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}