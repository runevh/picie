import { IconHome2 } from "@tabler/icons-react"
import { Route } from "../router/AppRouter";

export type NavbarInfo = {
  label: string;
  icon: typeof IconHome2;
}

export type NavbarProps = {
  routes: Route[];
}

export type NavbarItemProps = {
  icon: typeof IconHome2;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}