import { TestBed } from "@angular/core/testing";
import { CurrentUserService } from "./current-user.service";

describe("CurrentUserService", () => {
  it("starts as an anonymous user and can be set and cleared", () => {
    const service = TestBed.inject(CurrentUserService);
    expect(service.user().name).toBe("Guest");

    service.setUser({ name: "Ada", role: "Admin", avatarUrl: "a.png" });
    expect(service.user().name).toBe("Ada");

    service.clear();
    expect(service.user().name).toBe("Guest");
  });
});
