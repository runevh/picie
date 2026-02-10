import { Box, Flex } from "@mantine/core";
import { ReactNode } from "react";
import { DesktopNavbar } from "./DesktopNavbar";
import { testRoutes } from "../router/AppRouter";
import { MobileNavbar } from "./MobileNavbar";
import { useIsMobile } from "../../util/LayoutUtil";
import { Background } from "./Background";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Flex direction="column" h="100vh" style={{ width: "100%" }}>
        <Background
          component="main"
          style={{
            flex: 1,
            width: "100%",
            overflowY: "auto",
          }}
        >
          {children}
        </Background>
        <MobileNavbar routes={testRoutes} />
      </Flex>
    );
  }

  return (
    <Flex h="100vh" style={{ width: "100%" }}>
      <DesktopNavbar routes={testRoutes} />
      <Background
        component="main"
        style={{
          flex: 1,
          width: "100%",
          overflowY: "auto",
        }}
      >
        {children}
      </Background>
    </Flex>
  );
}
