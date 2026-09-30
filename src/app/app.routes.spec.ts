import { appRoutes } from "./app.routes";
import { authGuard } from "./core/auth/auth.guard";
import { guestGuard } from "./core/auth/guest.guard";

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
});
