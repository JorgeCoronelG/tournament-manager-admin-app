import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { AuthTokenService } from "../../core/auth/auth-token.service";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { CurrentUserService } from "../../core/user/current-user.service";
import { LoginComponent } from "./login.component";

describe("LoginComponent", () => {
  const login = vi.fn();
  const setToken = vi.fn();
  const error = vi.fn();
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    login.mockReset();
    setToken.mockReset();
    error.mockReset();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: AuthApi, useValue: { login } },
        { provide: AuthTokenService, useValue: { setToken } },
        { provide: SnackbarService, useValue: { error } },
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
        user: {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
          photo_url: "",
        },
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
    expect(TestBed.inject(CurrentUserService).user().name).toBe("Ada Lovelace");
    expect(navigateByUrl).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a snackbar error on invalid credentials", async () => {
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
    expect(error).toHaveBeenCalledWith("Correo o contraseña incorrectos.");
  });

  it("remembers the email when rememberMe is checked", async () => {
    login.mockReturnValue(
      of({
        user: {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
          photo_url: "",
        },
        token: "token-123",
        token_type: "Bearer",
      }),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    loginForm.email().value.set("ada@example.com");
    loginForm.password().value.set("secret");
    loginForm.rememberMe().value.set(true);
    await fixture.componentInstance.login();

    expect(localStorage.getItem("app.auth.remembered-email")).toBe(
      "ada@example.com",
    );
  });

  it("forgets the email when rememberMe is unchecked", async () => {
    localStorage.setItem("app.auth.remembered-email", "old@example.com");
    login.mockReturnValue(
      of({
        user: {
          id: 1,
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
          photo_url: "",
        },
        token: "token-123",
        token_type: "Bearer",
      }),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    loginForm.email().value.set("ada@example.com");
    loginForm.password().value.set("secret");
    loginForm.rememberMe().value.set(false);
    await fixture.componentInstance.login();

    expect(localStorage.getItem("app.auth.remembered-email")).toBeNull();
  });

  it("prefills the email and checks rememberMe when one was remembered", () => {
    localStorage.setItem("app.auth.remembered-email", "ada@example.com");

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    expect(loginForm.email().value()).toBe("ada@example.com");
    expect(loginForm.rememberMe().value()).toBe(true);
  });
});
