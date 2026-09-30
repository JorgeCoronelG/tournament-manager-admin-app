import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { CurrentUserService } from "../user/current-user.service";
import { capabilityGuard } from "./capability.guard";

describe("capabilityGuard", () => {
  function run() {
    return TestBed.runInInjectionContext(() =>
      capabilityGuard("users.manage")(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
  }

  function signInAs(roles: Array<"superadmin" | "league_admin">) {
    TestBed.inject(CurrentUserService).setUser({
      name: "Ada",
      role: "",
      roles,
      avatarUrl: "a.png",
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it("allows a user whose roles grant the capability", () => {
    signInAs(["superadmin"]);

    expect(run()).toBe(true);
  });

  it("sends the rest of the users back to the dashboard", () => {
    signInAs(["league_admin"]);

    const result = run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      "/dashboard",
    );
  });
});
