import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { ForgotPasswordComponent } from "./forgot-password.component";

describe("ForgotPasswordComponent", () => {
  const forgotPassword = vi.fn();
  const resetPassword = vi.fn();
  const success = vi.fn();
  const info = vi.fn();
  const error = vi.fn();
  const notifyFailure = vi.fn();
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    forgotPassword.mockReset();
    resetPassword.mockReset();
    success.mockReset();
    info.mockReset();
    error.mockReset();
    notifyFailure.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: AuthApi, useValue: { forgotPassword, resetPassword } },
        {
          provide: SnackbarService,
          useValue: { success, info, error, notifyFailure },
        },
      ],
    });

    navigateByUrl = vi
      .spyOn(TestBed.inject(Router), "navigateByUrl")
      .mockResolvedValue(true);
  });

  it("does not request a code for an invalid email", async () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();

    await fixture.componentInstance.requestCode();

    expect(forgotPassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.step()).toBe("request");
  });

  it("requests a code and moves to the reset step", async () => {
    forgotPassword.mockReturnValue(
      of({ message: "Si el correo existe, se envió un código." }),
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const { requestForm } = fixture.componentInstance;
    fixture.detectChanges();

    requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();

    expect(forgotPassword).toHaveBeenCalledWith("ada@example.com");
    expect(info).toHaveBeenCalledWith(
      "Si el correo existe, se envió un código.",
    );
    expect(fixture.componentInstance.step()).toBe("reset");
  });

  it("stays on the request step when requesting a code fails", async () => {
    forgotPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            error: { error: "Demasiadas solicitudes." },
          }),
      ),
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const { requestForm } = fixture.componentInstance;
    fixture.detectChanges();

    requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();

    expect(info).not.toHaveBeenCalled();
    expect(fixture.componentInstance.step()).toBe("request");
  });

  it("rejects a reset form whose passwords don't match", () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const { resetForm } = fixture.componentInstance;
    fixture.detectChanges();

    resetForm.code().value.set("123456");
    resetForm.password().value.set("password123");
    resetForm.passwordConfirmation().value.set("different123");

    expect(resetForm.passwordConfirmation().invalid()).toBe(true);
  });

  it("resets the password and navigates to the login page", async () => {
    forgotPassword.mockReturnValue(of({ message: "Se envió un código." }));
    resetPassword.mockReturnValue(
      of({ message: "Contraseña actualizada correctamente." }),
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const { requestForm, resetForm } = fixture.componentInstance;
    fixture.detectChanges();

    requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();

    resetForm.code().value.set("123456");
    resetForm.password().value.set("password123");
    resetForm.passwordConfirmation().value.set("password123");
    await fixture.componentInstance.resetPassword();

    expect(resetPassword).toHaveBeenCalledWith(
      "ada@example.com",
      "123456",
      "password123",
      "password123",
    );
    expect(success).toHaveBeenCalledWith(
      "Contraseña actualizada correctamente.",
    );
    expect(navigateByUrl).toHaveBeenCalledWith("/");
  });

  it("shows or hides each password on demand", async () => {
    forgotPassword.mockReturnValue(of({ message: "Se envió un código." }));
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    fixture.componentInstance.requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();
    fixture.detectChanges();

    const inputs = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll(
          "input[autocomplete=new-password]",
        ),
      ).map((input) => (input as HTMLInputElement).type);
    const buttons = fixture.nativeElement.querySelectorAll(
      "button[matIconSuffix]",
    ) as NodeListOf<HTMLButtonElement>;

    expect(inputs()).toEqual(["password", "password"]);

    buttons[0].click();
    fixture.detectChanges();
    expect(inputs()).toEqual(["text", "password"]);

    buttons[1].click();
    buttons[0].click();
    fixture.detectChanges();
    expect(inputs()).toEqual(["password", "text"]);
  });

  it("does not navigate when the code is rejected", async () => {
    forgotPassword.mockReturnValue(of({ message: "Se envió un código." }));
    resetPassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { error: "Código inválido o expirado." },
          }),
      ),
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const { requestForm, resetForm } = fixture.componentInstance;
    fixture.detectChanges();

    requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();

    resetForm.code().value.set("000000");
    resetForm.password().value.set("password123");
    resetForm.passwordConfirmation().value.set("password123");
    await fixture.componentInstance.resetPassword();

    expect(success).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(notifyFailure).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
  });

  it("shows a failed code request in a snackbar", async () => {
    forgotPassword.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429 })),
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    fixture.componentInstance.requestForm.email().value.set("ada@example.com");
    await fixture.componentInstance.requestCode();

    expect(notifyFailure).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect(fixture.componentInstance.step()).toBe("request");
  });
});
