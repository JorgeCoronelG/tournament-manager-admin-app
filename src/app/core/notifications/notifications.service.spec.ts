import { TestBed } from "@angular/core/testing";
import { DateTime } from "luxon";
import { NotificationsService } from "./notifications.service";
import { AppNotification } from "./notification.interface";

const notification = (id: string, read = false): AppNotification => ({
  id,
  icon: "mat:info",
  label: `Notification ${id}`,
  colorClass: "text-primary-600",
  datetime: DateTime.local(),
  read,
});

describe("NotificationsService", () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = TestBed.inject(NotificationsService);
  });

  it("starts empty", () => {
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it("adds new notifications first and counts the unread ones", () => {
    service.add(notification("1"));
    service.add(notification("2", true));
    service.add(notification("3"));

    expect(service.notifications().map((n) => n.id)).toEqual(["3", "2", "1"]);
    expect(service.unreadCount()).toBe(2);
  });

  it("marks everything as read", () => {
    service.set([notification("1"), notification("2")]);
    service.markAllAsRead();

    expect(service.unreadCount()).toBe(0);
    expect(service.notifications()).toHaveLength(2);
  });
});
