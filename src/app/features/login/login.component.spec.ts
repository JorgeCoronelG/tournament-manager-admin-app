import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { AuthTokenService } from "../../core/auth/auth-token.service";
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
          roles: [{ id: 1, code: "superadmin", name: "Super Administrador" }],
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

  async function failWith(status: number, body?: unknown) {
    login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, error: body })),
    );

    const fixture = TestBed.createComponent(LoginComponent);
    const { loginForm } = fixture.componentInstance;
    fixture.detectChanges();

    loginForm.email().value.set("ada@example.com");
    loginForm.password().value.set("secret");
    await fixture.componentInstance.login();
    fixture.detectChanges();

    return fixture;
  }

  it("shows the server's message in a snackbar and keeps no session when access is not allowed (403)", async () => {
    await failWith(403, {
      code: 403,
      error: "Tu cuenta no tiene acceso al panel de administración.",
    });

    expect(error).toHaveBeenCalledWith(
      "Tu cuenta no tiene acceso al panel de administración.",
    );
    expect(setToken).not.toHaveBeenCalled();
    expect(TestBed.inject(CurrentUserService).user().id).toBe(0);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it("uses the server's message as it comes for any 403, such as a disabled account", async () => {
    await failWith(403, { code: 403, error: "La cuenta está desactivada." });

    expect(error).toHaveBeenCalledWith("La cuenta está desactivada.");
  });

  it("falls back to a generic message when the server sends none", async () => {
    await failWith(500);

    expect(error).toHaveBeenCalledWith(
      "No pudimos iniciar sesión. Inténtalo de nuevo.",
    );
  });

  it("shows a snackbar on invalid credentials", async () => {
    await failWith(401);

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
          roles: [{ id: 1, code: "superadmin", name: "Super Administrador" }],
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
          roles: [{ id: 1, code: "superadmin", name: "Super Administrador" }],
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
