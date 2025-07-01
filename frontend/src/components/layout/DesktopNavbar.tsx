import { Box, Group, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
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
          borderRight:
            "1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-5))",
          transition: "width 150ms ease",
          overflow: "hidden",
          willChange: "width",
        }}
      >
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
