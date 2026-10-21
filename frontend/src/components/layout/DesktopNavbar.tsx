import { Box, Group, Stack, Text, Tooltip, UnstyledButton, useComputedColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useRef, useState, useMemo } from "react";
import { NavbarItemProps, NavbarProps } from "./Navbar.types";
import { IconCameraSelfie, IconChevronLeftPipe, IconChevronRightPipe } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/UserContext";

export function DesktopNavbar({ routes } : NavbarProps) {
  const [collapsed, setCollapsed] = useDisclosure(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(80);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(14, 20, 33, 0.92)" : "rgba(255, 255, 255, 0.9)";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.45)";

  useEffect(() => {
    if (contentRef.current && !collapsed) {
      setContentWidth(contentRef.current.scrollWidth);
    }
  }, [collapsed]);

  const availableRoutes = useMemo(() => {
    return routes
      .filter((route) => { 
        if (!route.navbarInfo) return false;

        return route.type !== "ADMIN" || user?.admin;
      })
  }, [routes, user?.admin]);



  return (
    <>
      <Box
        ref={contentRef}
        ml={-4}
        w={collapsed ? "80px" : contentWidth}
        h="100vh"
        display={"flex"}
        p={"md"}
        style={{
          position: "relative",
          borderRight: `1px solid ${border}`,
          background: isDark
            ? "linear-gradient(180deg, rgba(17,24,39,0.92) 0%, rgba(17,24,39,0.86) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,250,255,0.9) 100%)",
          backdropFilter: "blur(10px)",
          transition: "width 150ms ease",
          overflow: "hidden",
          willChange: "width",
          boxShadow: isDark ? "16px 0 60px -60px rgba(0,0,0,0.8)" : "16px 0 60px -60px rgba(15, 23, 42, 0.4)",
        }}
      >
        <Box
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 70% 8%, rgba(52,125,244,0.12), transparent 28%)," +
              "radial-gradient(circle at 40% 92%, rgba(132,94,247,0.12), transparent 26%)",
            pointerEvents: "none",
          }}
        />
        <Stack justify="space-between" h="100%">
          <Stack gap={4}>
            <Group
              h={50}
              px={16}
              gap={16}
              wrap="nowrap"
              align="center"
              style={{ flex: "0 0 auto" }}
              mb={20}
            >
              <Box w={20} display="flex" style={{ justifyContent: "center", overflow: 'visible' }}>
                <IconCameraSelfie color="var(--mantine-color-blue-light-color)" width={50} stroke={1.4} style={{ transform: 'scale(1.4)', transformOrigin: 'center' }}/>
              </Box>
              {!collapsed && (
                <Box ml={12}>
                  <Text
                    size="md"
                    style={{ whiteSpace: "nowrap", lineHeight: 1 }}
                  >
                    Picie
                  </Text>
                  <Text
                    size="sm"
                    c={"dimmed"}
                    style={{ whiteSpace: "nowrap", lineHeight: 1 }}
                  >
                    Smarter Frames
                  </Text>
                </Box>
              )}
            </Group>

            {availableRoutes
              .map((link) => {
                const shouldShow = link.type !== "ADMIN" || user?.admin;

                return shouldShow ? (
                  <NavbarItem
                    key={link.path}
                    icon={link.navbarInfo!.icon}
                    label={link.navbarInfo!.label}
                    active={location.pathname === link.path}
                    collapsed={collapsed}
                    onClick={() => {navigate(link.path)}}
                  />
                ) : null;
              })}

          </Stack>
          <Stack>
            <NavbarItem
              icon={collapsed ? IconChevronRightPipe : IconChevronLeftPipe}
              label={collapsed ? "Expand" : "Collapse"}
              onClick={() => setCollapsed.toggle()}
              collapsed={collapsed}
            />
          </Stack>
        </Stack>
      </Box>
    </>
  )
}

export function NavbarItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: NavbarItemProps) {
  return (
    <Tooltip
      opened={collapsed ? undefined : false}
      label={label}
      position="right"
      transitionProps={{ duration: 0 }}
    >
      <UnstyledButton
        aria-label={label}
        onClick={onClick}
        className={"navbar-link"}
        data-active={active || undefined}
        data-with-text={!collapsed || undefined}
      >
        <Group h={50} px={16} gap={16} wrap="nowrap">
          <Box w={20} display="flex" style={{ justifyContent: "center" }}>
            <Icon size={20} stroke={1.5} />
          </Box>
          {!collapsed && (
            <Text size="md" style={{ whiteSpace: "nowrap" }} ml={12}>
              {label}
            </Text>
          )}
        </Group>
      </UnstyledButton>
    </Tooltip>
  );
}
