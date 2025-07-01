import { Routes, Route as RRoute, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/UserContext";
import Login from "../Login";
import { LoaderPage } from "./LoaderPage";
import { JSX } from "react";
import { NavbarInfo } from "../layout/Navbar.types";
import { Layout } from "../layout/Layout";
import { IconBrandSuperhuman, IconHome, IconLibraryPhoto, IconPhotoScan, IconUser } from "@tabler/icons-react";
import { PhotosPage } from "../photos/PhotosPage";
import { FramesPage } from "../frames/FramesPage";

export type AppRouterProps = {
  routes: Route[],
}

export type RouteType = "UNAUTHORIZED" | "AUTHORIZED" | "ADMIN" | "ALL";

export type Route = {
  type: RouteType,
  redirect?: string, // Page to redirect to when logged in
  path: string, // Path must start with a /
  element: JSX.Element, // Element to render
  navbarInfo?: NavbarInfo
}

export function AppRouter({routes} : AppRouterProps) {
  return (
    <Routes>
      {routes.map((route) => (
        <RRoute
          key={route.path}
          path={route.path}
          element={<ProtectedRoute route={route} />}
        />
      ))}
      {/* Optional: fallback route */}
      <RRoute path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

function ProtectedRoute({ route }: { route: Route }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoaderPage />;
  }

  const isAllowed = (() => {
    if (route.type === "ALL") return true;
    if (route.type === "UNAUTHORIZED" && !isAuthenticated) return true;
    if (route.type === "AUTHORIZED" && isAuthenticated) return true;
    if (route.type === "ADMIN" && isAuthenticated && user?.admin) return true;
    return false;
  })();

  if (!isAllowed) {
    return <Navigate to={route.redirect || "/login"} replace />;
  }

  return route.element;
}


// eslint-disable-next-line react-refresh/only-export-components
export const testRoutes: Route[] = [
  {
    type: "UNAUTHORIZED",
    redirect: "/",
    path: "/login",
    element: <Login/>
  },
  {
    type: "AUTHORIZED",
    redirect: "/login",
    path: "/",
    element: <Layout>Home</Layout>,
    navbarInfo: {
      label: "Home",
      icon: IconHome,
    }
  },
  {
    type: "AUTHORIZED",
    redirect: "/login",
    path: "/photos",
    element: <Layout><PhotosPage/></Layout>,
    navbarInfo: {
      label: "Photos",
      icon: IconLibraryPhoto,
    }
  },
  {
    type: "AUTHORIZED",
    redirect: "/login",
    path: "/frames",
    element: <Layout><FramesPage/></Layout>,
    navbarInfo: {
      label: "Frames",
      icon: IconPhotoScan,
    }
  },
  {
    type: "AUTHORIZED",
    redirect: "/login",
    path: "/account",
    element: <Layout>Account</Layout>,
    navbarInfo: {
      label: "Account",
      icon: IconUser,
    }
  },
  {
    type: "ADMIN",
    redirect: "/",
    path: "/admin",
    element: <Layout>Admin</Layout>,
    navbarInfo: {
      label: "Admin",
      icon: IconBrandSuperhuman,
    }
  }
]
