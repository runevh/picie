import { Box, Flex } from "@mantine/core";
import { ReactNode } from "react";
import { DesktopNavbar } from "./DesktopNavbar";
import { testRoutes } from "../router/AppRouter";
import { MobileNavbar } from "./MobileNavbar";
import { useIsMobile } from "../../util/LayoutUtil";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Flex direction="column" h="100vh" style={{ width: "100%" }}>
        <Box
          component="main"
          style={{
            flex: 1,
            width: "100%",
            overflowY: "auto",
          }}
        >
          {children}
        </Box>
        <MobileNavbar routes={testRoutes} />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" style={{ width: "100%" }}>
      <DesktopNavbar routes={testRoutes} />
      <Box
        component="main"
        style={{
          flex: 1,
          width: "100%",
          overflowY: "auto",
        }}
      >
        {children}
      </Box>
    </Flex>
  );
}
