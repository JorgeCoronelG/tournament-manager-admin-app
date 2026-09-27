import { TranslocoPipe } from "@jsverse/transloco";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from "@angular/material/core";
import { AppPopoverRef } from "@ui/components/app-popover/app-popover-ref";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { AuthApi } from "../../../core/auth/auth.api";
import { AuthTokenService } from "../../../core/auth/auth-token.service";
import { CurrentUserService } from "../../../core/user/current-user.service";

/**
 * Content of the popover opened from the sidenav footer and from the toolbar.
 */
@Component({
  selector: "app-user-menu",
  templateUrl: "./user-menu.component.html",
  styleUrls: ["./user-menu.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, MatIconModule, MatRippleModule],
})
export class UserMenuComponent {
  private readonly popoverRef = inject(AppPopoverRef);
  private readonly layoutService = inject(AppLayoutService);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly authToken = inject(AuthTokenService);
  private readonly currentUser = inject(CurrentUserService);

  readonly user = this.currentUser.user;

  openPreferences(): void {
    this.layoutService.openConfigpanel();
    this.popoverRef.close();
  }

  async logout(): Promise<void> {
    this.popoverRef.close();

    try {
      await firstValueFrom(this.authApi.logout());
    } catch {
      // The token might already be invalid/expired: log out locally regardless
    }

    this.authToken.clear();
    this.currentUser.clear();
    await this.router.navigateByUrl("/");
  }
}
