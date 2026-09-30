import { filterNavigation } from "./navigation-filter";
import { NavigationItem } from "./navigation-item.interface";
import { Capability } from "../auth/role-capabilities";

const items: NavigationItem[] = [
  {
    type: "subheading",
    label: "nav.main",
    children: [
      { type: "link", label: "nav.dashboard", route: "/dashboard" },
      {
        type: "link",
        label: "nav.users",
        route: "/dashboard/usuarios",
        capability: "users.manage",
      },
    ],
  },
  {
    type: "subheading",
    label: "nav.admin",
    capability: "leagues.manage",
    children: [
      { type: "link", label: "nav.leagues", route: "/dashboard/ligas" },
    ],
  },
  {
    type: "dropdown",
    label: "nav.league",
    children: [
      {
        type: "link",
        label: "nav.tournaments",
        route: "/dashboard/torneos",
        capability: "tournaments.manage",
      },
    ],
  },
];

function labels(result: NavigationItem[]): string[] {
  return result.flatMap((item) =>
    item.type === "link"
      ? [item.label]
      : [item.label, ...item.children.map((child) => child.label)],
  );
}

function allowing(...granted: Capability[]) {
  return (capability: Capability) => granted.includes(capability);
}

describe("filterNavigation", () => {
  it("keeps the entries without a capability for everyone", () => {
    expect(labels(filterNavigation(items, allowing()))).toEqual([
      "nav.main",
      "nav.dashboard",
    ]);
  });

  it("shows an entry only to users holding its capability", () => {
    expect(labels(filterNavigation(items, allowing("users.manage")))).toContain(
      "nav.users",
    );
    expect(labels(filterNavigation(items, allowing()))).not.toContain(
      "nav.users",
    );
  });

  it("hides a whole group when the user lacks its capability", () => {
    const result = labels(
      filterNavigation(items, allowing("tournaments.manage")),
    );

    expect(result).not.toContain("nav.admin");
    expect(result).toContain("nav.league");
    expect(result).toContain("nav.tournaments");
  });

  it("drops a group that ends up with no visible children", () => {
    expect(labels(filterNavigation(items, allowing()))).not.toContain(
      "nav.league",
    );
  });

  it("does not mutate the original definition", () => {
    filterNavigation(items, allowing());

    expect(labels(items)).toContain("nav.users");
  });
});
