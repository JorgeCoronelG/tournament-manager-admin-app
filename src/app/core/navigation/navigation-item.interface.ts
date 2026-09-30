import { Capability } from "../auth/role-capabilities";

export type NavigationItem =
  NavigationLink | NavigationDropdown | NavigationSubheading;

export interface NavigationLink {
  type: "link";
  /** Hidden from users whose roles do not grant it; no value means any signed-in user */
  capability?: Capability;
  route: string | (() => void);
  fragment?: string;
  label: string;
  icon?: string;
  routerLinkActiveOptions?: { exact: boolean };
  badge?: {
    value: string;
    bgClass: string;
    textClass: string;
  };
}

export interface NavigationDropdown {
  type: "dropdown";
  capability?: Capability;
  label: string;
  icon?: string;
  children: Array<NavigationLink | NavigationDropdown>;
  badge?: {
    value: string;
    bgClass: string;
    textClass: string;
  };
}

export interface NavigationSubheading {
  type: "subheading";
  capability?: Capability;
  label: string;
  children: Array<NavigationLink | NavigationDropdown>;
}
