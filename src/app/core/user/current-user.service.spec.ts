import { TestBed } from "@angular/core/testing";
import { CurrentUserService } from "./current-user.service";

describe("CurrentUserService", () => {
  it("starts as an anonymous user and can be set and cleared", () => {
    const service = TestBed.inject(CurrentUserService);
    expect(service.user().name).toBe("Guest");

    service.setUser({
      id: 1,
      name: "Ada",
      role: "Admin",
      roles: [],
      avatarUrl: "a.png",
    });
    expect(service.user().name).toBe("Ada");

    service.clear();
    expect(service.user().name).toBe("Guest");
  });

  it("forgets the saved league when the session ends", () => {
    const service = TestBed.inject(CurrentUserService);
    service.setUser({
      id: 1,
      name: "Ada",
      role: "",
      roles: [],
      avatarUrl: null,
    });
    localStorage.setItem("app.active-league.1", "4");
    localStorage.setItem("app.active-league.2", "6");

    service.clear();

    expect(localStorage.getItem("app.active-league.1")).toBeNull();
    expect(localStorage.getItem("app.active-league.2")).toBeNull();
    localStorage.clear();
  });

  it("forgets the saved league even when the user was never loaded (token rejected on reload)", () => {
    const service = TestBed.inject(CurrentUserService);
    localStorage.setItem("app.active-league.1", "4");
    localStorage.setItem("app.other", "keep");

    service.clear();

    expect(localStorage.getItem("app.active-league.1")).toBeNull();
    expect(localStorage.getItem("app.other")).toBe("keep");
    localStorage.clear();
  });

  it("grants the union of the capabilities of all the user's roles", () => {
    const service = TestBed.inject(CurrentUserService);
    const user = { id: 1, name: "Ada", role: "", avatarUrl: "a.png" };

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
