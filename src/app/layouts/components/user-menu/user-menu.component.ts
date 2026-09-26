import { TranslocoPipe } from "@jsverse/transloco";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from "@angular/material/core";
import { AppPopoverRef } from "@ui/components/app-popover/app-popover-ref";
import { AppLayoutService } from "@ui/services/app-layout.service";
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

  readonly user = inject(CurrentUserService).user;

  openPreferences(): void {
    this.layoutService.openConfigpanel();
    this.popoverRef.close();
  }
}
