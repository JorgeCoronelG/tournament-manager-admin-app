import { computed, Service, signal } from "@angular/core";
import { AppNotification } from "./notification.interface";

/**
 * In-memory notification list shown in the toolbar. Feed it from wherever the
 * notifications come from (API, websocket...) with `add()`/`set()`.
 */
@Service()
export class NotificationsService {
  private readonly _notifications = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(
    () => this._notifications().filter((n) => !n.read).length,
  );

  set(notifications: AppNotification[]): void {
    this._notifications.set(notifications);
  }

  add(notification: AppNotification): void {
    this._notifications.update((current) => [notification, ...current]);
  }

  markAllAsRead(): void {
    this._notifications.update((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  }
}
