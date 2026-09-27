import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { AuthTokenService } from "../../core/auth/auth-token.service";
import { CurrentUserService } from "../../core/user/current-user.service";
import { LoginComponent } from "./login.component";

describe("LoginComponent", () => {
  const login = vi.fn();
  const setToken = vi.fn();
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    login.mockReset();
    setToken.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: AuthApi, useValue: { login } },
        { provide: AuthTokenService, useValue: { setToken } },
      ],
    });

    navigateByUrl = vi
      .spyOn(TestBed.inject(Router), "navigateByUrl")
      .mockResolvedValue(true);
  });

  it("does not submit an invalid form", async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    await fixture.componentInstance.login();

    expect(login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.loginForm.email().invalid()).toBe(true);
  });

  it("logs in, stores the token and navigates to the dashboard", async () => {
    login.mockReturnValue(
      of({
        user: { id: 1, name: "Ada", email: "ada@example.com" },
        token: "token-123",
        token_type: "Bearer",
      }),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    loginForm.email().value.set("ada@example.com");
    loginForm.password().value.set("secret");
    await fixture.componentInstance.login();

    expect(login).toHaveBeenCalledWith("ada@example.com", "secret");
    expect(setToken).toHaveBeenCalledWith("token-123");
    expect(TestBed.inject(CurrentUserService).user().name).toBe("Ada");
    expect(navigateByUrl).toHaveBeenCalledWith("/dashboard");
  });

  it("shows an inline error on invalid credentials", async () => {
    login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401 })),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    loginForm.email().value.set("ada@example.com");
    loginForm.password().value.set("wrong");
    await fixture.componentInstance.login();

    expect(setToken).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorKey()).toBe(
      "login.invalidCredentials",
    );
  });
});
