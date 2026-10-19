import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { appRoutes } from "./app.routes";
import { authGuard } from "./core/auth/auth.guard";
import { guestGuard } from "./core/auth/guest.guard";
import { Role } from "./core/auth/role.model";
import { CurrentUserService } from "./core/user/current-user.service";

describe("appRoutes", () => {
  it("keeps the activation page public but only for guests", () => {
    const route = appRoutes.find((r) => r.path === "activar-cuenta");

    expect(route?.canActivate).toEqual([guestGuard]);
  });

  it("protects the users page with a capability guard inside the layout", () => {
    const layout = appRoutes.find((r) => r.path === "dashboard");
    const users = layout?.children?.find((r) => r.path === "usuarios");

    expect(layout?.canActivate).toEqual([authGuard]);
    expect(users?.canActivate).toHaveLength(1);
  });

  it("protects the leagues page with a capability guard inside the layout", () => {
    const layout = appRoutes.find((r) => r.path === "dashboard");
    const leagues = layout?.children?.find((r) => r.path === "ligas");

    expect(leagues?.canActivate).toHaveLength(1);
  });

  it("protects the tournaments page with a capability guard inside the layout", () => {
    const layout = appRoutes.find((r) => r.path === "dashboard");
    const tournaments = layout?.children?.find((r) => r.path === "torneos");

    expect(tournaments?.canActivate).toHaveLength(1);
  });

  describe("tournaments route", () => {
    function canEnter(role: Role) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      TestBed.inject(CurrentUserService).setUser({
        id: 1,
        name: "Ada",
        role: "",
        roles: [role],
        avatarUrl: "a.png",
      });

      const layout = appRoutes.find((r) => r.path === "dashboard");
      const guard = layout?.children?.find((r) => r.path === "torneos")
        ?.canActivate?.[0] as CanActivateFn;

      return TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    }

    it("lets the superadmin and the league admin in", () => {
      expect(canEnter("superadmin")).toBe(true);
      TestBed.resetTestingModule();
      expect(canEnter("league_admin")).toBe(true);
    });

    it("sends a player back to the dashboard", () => {
      expect(canEnter("player")).toBeInstanceOf(UrlTree);
    });
  });

  it("protects the referees page with a capability guard inside the layout", () => {
    const layout = appRoutes.find((r) => r.path === "dashboard");
    const referees = layout?.children?.find((r) => r.path === "arbitros");

    expect(referees?.canActivate).toHaveLength(1);
  });

  describe("referees route", () => {
    function canEnter(role: Role) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      TestBed.inject(CurrentUserService).setUser({
        id: 1,
        name: "Ada",
        role: "",
        roles: [role],
        avatarUrl: "a.png",
      });

      const layout = appRoutes.find((r) => r.path === "dashboard");
      const guard = layout?.children?.find((r) => r.path === "arbitros")
        ?.canActivate?.[0] as CanActivateFn;

      return TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    }

    it("lets the superadmin and the league admin in", () => {
      expect(canEnter("superadmin")).toBe(true);
      TestBed.resetTestingModule();
      expect(canEnter("league_admin")).toBe(true);
    });

    it("sends a player back to the dashboard", () => {
      expect(canEnter("player")).toBeInstanceOf(UrlTree);
    });
  });

  describe("leagues route", () => {
    function canEnter(role: Role) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      TestBed.inject(CurrentUserService).setUser({
        id: 1,
        name: "Ada",
        role: "",
        roles: [role],
        avatarUrl: "a.png",
      });

      const layout = appRoutes.find((r) => r.path === "dashboard");
      const guard = layout?.children?.find((r) => r.path === "ligas")
        ?.canActivate?.[0] as CanActivateFn;

      return TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    }

    it("lets the superadmin in", () => {
      expect(canEnter("superadmin")).toBe(true);
    });

    it("sends a league admin back to the dashboard", () => {
      expect(canEnter("league_admin")).toBeInstanceOf(UrlTree);
    });
  });

  describe("fields route", () => {
    function canEnter(role: Role) {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      TestBed.inject(CurrentUserService).setUser({
        id: 1,
        name: "Ada",
        role: "",
        roles: [role],
        avatarUrl: "a.png",
      });

      const layout = appRoutes.find((r) => r.path === "dashboard");
      const guard = layout?.children?.find((r) => r.path === "canchas")
        ?.canActivate?.[0] as CanActivateFn;

      return TestBed.runInInjectionContext(() =>
        guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    }

    it("lets the superadmin and the league admin in", () => {
      expect(canEnter("superadmin")).toBe(true);
      TestBed.resetTestingModule();
      expect(canEnter("league_admin")).toBe(true);
    });

    it("sends a player back to the dashboard", () => {
      expect(canEnter("player")).toBeInstanceOf(UrlTree);
    });
  });
});
