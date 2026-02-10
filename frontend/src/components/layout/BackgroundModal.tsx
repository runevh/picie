import { Box, Modal, ModalProps } from "@mantine/core";
import { ReactNode } from "react";
import { Background } from "./Background";

type BackgroundModalProps = ModalProps & {
  /** Padding applied inside the background wrapper */
  innerPadding?: ModalProps["padding"];
  children?: ReactNode;
};

/**
 * Drop-in Modal that renders the shared animated <Background> behind its content.
 * Helps keep overlays consistent with the shell styling.
 */
export function BackgroundModal({ children, innerPadding = "md", radius = "lg", ...rest }: BackgroundModalProps) {
  return (
    <Modal
      {...rest}
      radius={radius}
      styles={{
        content: {
          background: "transparent",
          padding: 0,
          overflow: "hidden",
        },
        body: { padding: 0, background: "transparent" },
        header: { background: "transparent" },
      }}
    >
      <Background
        style={{
          borderRadius: typeof radius === "number" ? radius : undefined,
        }}
      >
        <Box p={innerPadding}>{children}</Box>
      </Background>
    </Modal>
  );
}
