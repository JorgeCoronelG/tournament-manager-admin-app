import { TestBed } from "@angular/core/testing";
import { firstValueFrom, of, throwError } from "rxjs";
import { CurrentUserService } from "../user/current-user.service";
import { AuthApi } from "./auth.api";
import { AuthSessionService } from "./auth-session.service";
import { AuthTokenService } from "./auth-token.service";

describe("AuthSessionService", () => {
  const me = vi.fn();
  const clear = vi.fn();
  let token: string | null;

  beforeEach(() => {
    me.mockReset();
    clear.mockReset();
    token = null;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApi, useValue: { me } },
        {
          provide: AuthTokenService,
          useValue: { token: () => token, clear },
        },
      ],
    });
  });

  it("is not authenticated when there is no token", async () => {
    const authenticated = await firstValueFrom(
      TestBed.inject(AuthSessionService).isAuthenticated(),
    );

    expect(authenticated).toBe(false);
    expect(me).not.toHaveBeenCalled();
  });

  it("is authenticated and sets the current user when the token is valid", async () => {
    token = "token-123";
    me.mockReturnValue(
      of({
        id: 1,
        name: "Ada",
        surnames: "Lovelace",
        email: "ada@example.com",
        photo_url: "",
      }),
    );

    const authenticated = await firstValueFrom(
      TestBed.inject(AuthSessionService).isAuthenticated(),
    );

    expect(authenticated).toBe(true);
    expect(TestBed.inject(CurrentUserService).user().name).toBe("Ada Lovelace");
  });

  it("clears the session when the token is invalid", async () => {
    token = "token-123";
    me.mockReturnValue(throwError(() => new Error("401")));

    const authenticated = await firstValueFrom(
      TestBed.inject(AuthSessionService).isAuthenticated(),
    );

    expect(authenticated).toBe(false);
    expect(clear).toHaveBeenCalled();
  });
});
