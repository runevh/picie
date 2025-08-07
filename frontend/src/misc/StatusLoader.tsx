import { Loader, Box, Flex } from "@mantine/core";
import { useEffect, useState } from "react";

type StatusLoaderProps = {
  children: React.ReactNode;
  boxWidth?: number | string;
  boxHeight?: number | string;
};

export function StatusLoader({
  children,
  boxWidth = 200,
  boxHeight = 40,
}: StatusLoaderProps) {
  const [currentChild, setCurrentChild] = useState<React.ReactNode>(children);

  useEffect(() => {
    setCurrentChild(children);
  }, [children]);

  return (
    <Flex direction="column" align="center">
      <Loader size="xl" mb={30} />
      <Box
        style={{
          width: boxWidth,
          height: boxHeight,
          textAlign: "center",
          userSelect: "none",
        }}
      >
        {currentChild}
      </Box>
    </Flex>
  );
}
