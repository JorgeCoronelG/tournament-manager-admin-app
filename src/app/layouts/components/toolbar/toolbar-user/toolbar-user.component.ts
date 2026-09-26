import { TranslocoPipe } from "@jsverse/transloco";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { AppPopoverService } from "@ui/components/app-popover/app-popover.service";
import { UserMenuComponent } from "../../user-menu/user-menu.component";
import { CurrentUserService } from "../../../../core/user/current-user.service";
import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from "@angular/material/core";

@Component({
  selector: "app-toolbar-user",
  templateUrl: "./toolbar-user.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, MatRippleModule, MatIconModule],
})
export class ToolbarUserComponent {
  private popover = inject(AppPopoverService);

  readonly user = inject(CurrentUserService).user;
  readonly dropdownOpen = signal(false);

  showPopover(originRef: HTMLElement) {
    this.dropdownOpen.set(true);

    const popoverRef = this.popover.open({
      content: UserMenuComponent,
      origin: originRef,
      offsetY: 12,
      position: [
        {
          originX: "center",
          originY: "top",
          overlayX: "center",
          overlayY: "bottom",
        },
        {
          originX: "end",
          originY: "bottom",
          overlayX: "end",
          overlayY: "top",
        },
      ],
    });

    popoverRef.afterClosed$.subscribe(() => {
      this.dropdownOpen.set(false);
    });
  }
}
