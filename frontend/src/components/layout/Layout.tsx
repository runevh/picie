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
  return (
    <Flex>
      {!isMobile && <DesktopNavbar routes={testRoutes} />}
      <Box style={{ flex: 1 }}>{children}</Box>
      {isMobile && <MobileNavbar routes={testRoutes} />}
    </Flex>
  )
}