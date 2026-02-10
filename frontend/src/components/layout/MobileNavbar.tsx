import { Box, Group, Text, useComputedColorScheme } from "@mantine/core";
import { NavbarItemProps, NavbarProps } from "./Navbar.types";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/UserContext";

export function MobileNavbar({routes} : NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const isDark = computedColorScheme === "dark";
  const surface = isDark ? "rgba(12, 16, 26, 0.94)" : "rgba(255, 255, 255, 0.92)";
  const border = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const shadow = isDark ? "0 -18px 60px rgba(0,0,0,0.55)" : "0 -18px 50px rgba(15,23,42,0.28)";
  
  const availableRoutes = useMemo(() => {
    return routes
      .filter((route) => { 
        if (!route.navbarInfo) return false;
    
        return route.type !== "ADMIN" || user?.admin;
      })
  }, [routes, user?.admin]);

  return (
    <Box
      component="nav"
      h={76}
      px="sm"
      bg={surface}
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: `1px solid ${border}`,
        width: "100%",
        flexShrink: 0,
        zIndex: 20,
        backdropFilter: "blur(12px)",
        boxShadow: shadow,
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% -12%, rgba(100,126,255,0.12), transparent 32%)," +
            "radial-gradient(circle at 82% 120%, rgba(111,76,255,0.12), transparent 30%)",
          pointerEvents: "none",
        }}
      />
      <Group justify="space-around" align="center" h="100%">
        {availableRoutes.map((route) => {
          const isActive = location.pathname === route.path;
          
          return (
            <NavbarItem
              key={route.path}
              onClick={() => navigate(route.path)}
              icon={route.navbarInfo!.icon}
              label={route.navbarInfo!.label}
              collapsed={false}
              active={isActive}
            />
          )
        })}
      </Group>
    </Box>
  );
}

export function NavbarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: NavbarItemProps) {
  return (
    <Box
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: "8px 8px",
        gap: 2,
        borderRadius: 12,
        flex: 1,
        transition: "transform 140ms ease, color 140ms ease",
        transform: active ? "translateY(-1px)" : "none",
      }}
    >
      <Box
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          backgroundColor: "transparent",
          border: "none",
        }}
      >
        <Icon
          size={22}
          stroke={1.6}
          color={
            active
              ? "var(--mantine-color-blue-4)"
              : "var(--mantine-color-dimmed)"
          }
        />
      </Box>
      <Text size="xs" fw={600} c={active ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)"}>
        {label}
      </Text>
    </Box>
  );
}
