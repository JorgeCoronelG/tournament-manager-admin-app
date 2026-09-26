import { TranslocoPipe } from "@jsverse/transloco";
import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { MatRippleModule } from "@angular/material/core";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { NotificationsService } from "../../../../../core/notifications/notifications.service";

@Component({
  selector: "app-toolbar-notifications-dropdown",
  templateUrl: "./toolbar-notifications-dropdown.component.html",
  styleUrls: ["./toolbar-notifications-dropdown.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
    AppDateFormatRelativePipe,
  ],
})
export class ToolbarNotificationsDropdownComponent {
  private readonly service = inject(NotificationsService);

  readonly notifications = this.service.notifications;
  readonly unreadCount = this.service.unreadCount;

  markAllAsRead(): void {
    this.service.markAllAsRead();
  }
}
