import { Box, Group } from "@mantine/core";
import { NavbarItemProps, NavbarProps } from "./Navbar.types";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/UserContext";

export function MobileNavbar({routes} : NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
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
      h={60}
      bg="var(--mantine-color-body)"
      style={{
        borderTop: "1px solid var(--mantine-color-gray-3)",
        width: "100%",
        flexShrink: 0,
        zIndex: 10,
        position: "relative",
      }}
    >
      <Group justify="space-around" align="center" h="100%">
        {availableRoutes.map((route) => {
          const isActive = location.pathname === route.path;
          
          return (
            <NavbarItem
              key={route.path}
              onClick={() => navigate(route.path)}
              icon={route.navbarInfo!.icon}
              label={""}
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
  active,
  onClick,
}: NavbarItemProps) {
  return (
    <Box
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <Box
        p={8}
        style={{
          padding: 8,
          borderRadius: "50%",
          border: "2px solid",
          backgroundColor: active
            ? "var(--mantine-color-blue-light)"
            : "transparent",
          borderColor: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          size={24}
          stroke={1.5}
          color={
            active
              ? "var(--mantine-color-blue-filled)"
              : "var(--mantine-color-dimmed)"
          }
        />
      </Box>
    </Box>
  );
}
