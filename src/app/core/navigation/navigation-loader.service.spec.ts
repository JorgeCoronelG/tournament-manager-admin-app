import { TestBed } from "@angular/core/testing";
import { Role } from "../auth/role.model";
import { CurrentUserService } from "../user/current-user.service";
import { NavigationItem } from "./navigation-item.interface";
import { NavigationLoaderService } from "./navigation-loader.service";

function labels(items: NavigationItem[]): string[] {
  return items.flatMap((item) =>
    item.type === "link"
      ? [item.label]
      : [item.label, ...labels(item.children)],
  );
}

describe("NavigationLoaderService", () => {
  function signInAs(...roles: Role[]): NavigationLoaderService {
    TestBed.inject(CurrentUserService).setUser({
      name: "Ada",
      role: "",
      roles,
      avatarUrl: "a.png",
    });

    return TestBed.inject(NavigationLoaderService);
  }

  it("shows the superadmin the dashboard, and users", () => {
    expect(labels(signInAs("superadmin").items())).toEqual([
      "nav.main",
      "nav.dashboard",
      "nav.users",
      "nav.manage",
    ]);
  });

  it("shows the roles without capabilities only the dashboard", () => {
    expect(labels(signInAs("league_admin").items())).toEqual([
      "nav.main",
      "nav.dashboard",
    ]);
  });

  it("follows the session when the user signs out", () => {
    const service = signInAs("superadmin");
    expect(labels(service.items())).toContain("nav.users");

    TestBed.inject(CurrentUserService).clear();
    expect(labels(service.items())).not.toContain("nav.users");
  });
});
