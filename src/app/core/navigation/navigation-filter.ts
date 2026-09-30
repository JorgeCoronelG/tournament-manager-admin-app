import { Capability } from "../auth/role-capabilities";
import {
  NavigationDropdown,
  NavigationItem,
  NavigationLink,
} from "./navigation-item.interface";

type NavigationChild = NavigationLink | NavigationDropdown;
type CanFn = (capability: Capability) => boolean;

function isAllowed(item: NavigationItem, can: CanFn): boolean {
  return !item.capability || can(item.capability);
}

function filterChildren(
  children: NavigationChild[],
  can: CanFn,
): NavigationChild[] {
  return children.flatMap((child): NavigationChild[] => {
    if (!isAllowed(child, can)) {
      return [];
    }

    if (child.type === "link") {
      return [child];
    }

    const visible = filterChildren(child.children, can);

    return visible.length ? [{ ...child, children: visible }] : [];
  });
}

/** Drops what the user cannot see, and any group that ends up empty */
export function filterNavigation(
  items: NavigationItem[],
  can: CanFn,
): NavigationItem[] {
  return items.flatMap((item): NavigationItem[] => {
    if (item.type !== "subheading") {
      return filterChildren([item], can);
    }

    if (!isAllowed(item, can)) {
      return [];
    }

    const visible = filterChildren(item.children, can);

    return visible.length ? [{ ...item, children: visible }] : [];
  });
}
