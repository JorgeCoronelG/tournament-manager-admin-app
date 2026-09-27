import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { firstValueFrom, Observable, of } from "rxjs";
import { AuthSessionService } from "./auth-session.service";
import { guestGuard } from "./guest.guard";

describe("guestGuard", () => {
  const isAuthenticated = vi.fn();

  function run() {
    return TestBed.runInInjectionContext(() =>
      firstValueFrom(
        guestGuard(
          {} as ActivatedRouteSnapshot,
          {} as RouterStateSnapshot,
        ) as Observable<boolean | UrlTree>,
      ),
    );
  }

  beforeEach(() => {
    isAuthenticated.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { isAuthenticated } },
      ],
    });
  });

  it("allows navigation when there is no valid session", async () => {
    isAuthenticated.mockReturnValue(of(false));

    expect(await run()).toBe(true);
  });

  it("redirects to the dashboard when there already is a valid session", async () => {
    isAuthenticated.mockReturnValue(of(true));

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      "/dashboard",
    );
  });
});
