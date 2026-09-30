import { TestBed } from "@angular/core/testing";
import { CurrentUserService } from "./current-user.service";

describe("CurrentUserService", () => {
  it("starts as an anonymous user and can be set and cleared", () => {
    const service = TestBed.inject(CurrentUserService);
    expect(service.user().name).toBe("Guest");

    service.setUser({
      name: "Ada",
      role: "Admin",
      roles: [],
      avatarUrl: "a.png",
    });
    expect(service.user().name).toBe("Ada");

    service.clear();
    expect(service.user().name).toBe("Guest");
  });

  it("grants the union of the capabilities of all the user's roles", () => {
    const service = TestBed.inject(CurrentUserService);
    const user = { name: "Ada", role: "", avatarUrl: "a.png" };

    expect(service.can("tournaments.manage")).toBe(false);

    service.setUser({ ...user, roles: ["player", "league_admin"] });
    expect(service.can("tournaments.manage")).toBe(true);
    expect(service.can("users.manage")).toBe(false);

    service.setUser({ ...user, roles: ["superadmin"] });
    expect(service.can("users.manage")).toBe(true);

    service.clear();
    expect(service.can("users.manage")).toBe(false);
  });
});
