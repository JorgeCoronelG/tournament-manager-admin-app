import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { AppPopoverRef } from "@ui/components/app-popover/app-popover-ref";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { AuthApi } from "../../../core/auth/auth.api";
import { AuthTokenService } from "../../../core/auth/auth-token.service";
import { CurrentUserService } from "../../../core/user/current-user.service";
import { UserMenuComponent } from "./user-menu.component";

describe("UserMenuComponent", () => {
  function setup(isDesktop: boolean) {
    const layout = {
      isDesktop: signal(isDesktop),
      closeSidenav: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AppLayoutService, useValue: layout },
        { provide: AppPopoverRef, useValue: { close: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: Router, useValue: {} },
        { provide: AuthApi, useValue: {} },
        { provide: AuthTokenService, useValue: {} },
        { provide: CurrentUserService, useValue: { user: signal(null) } },
      ],
    });

    const component = TestBed.runInInjectionContext(
      () => new UserMenuComponent(),
    );

    return { component, layout };
  }

  it("keeps the sidenav open on desktop when changing the password", () => {
    const { component, layout } = setup(true);

    component.openChangePassword();

    expect(layout.closeSidenav).not.toHaveBeenCalled();
  });

  it("closes the sidenav drawer below desktop when changing the password", () => {
    const { component, layout } = setup(false);

    component.openChangePassword();

    expect(layout.closeSidenav).toHaveBeenCalled();
  });
});
