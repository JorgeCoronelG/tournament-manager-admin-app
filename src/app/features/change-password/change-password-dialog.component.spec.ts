import { TestBed } from "@angular/core/testing";
import { HttpErrorResponse } from "@angular/common/http";
import { MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { ChangePasswordDialogComponent } from "./change-password-dialog.component";

describe("ChangePasswordDialogComponent", () => {
  const changePassword = vi.fn();
  const close = vi.fn();
  const success = vi.fn();
  const error = vi.fn();

  beforeEach(() => {
    changePassword.mockReset();
    close.mockReset();
    success.mockReset();
    error.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: AuthApi, useValue: { changePassword } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SnackbarService, useValue: { success, error } },
      ],
    });
  });

  it("does not submit an invalid form", async () => {
    const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    fixture.detectChanges();

    await fixture.componentInstance.save();

    expect(changePassword).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("rejects a confirmation that doesn't match the new password", () => {
    const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    const { changePasswordForm } = fixture.componentInstance;
    fixture.detectChanges();

    changePasswordForm.currentPassword().value.set("old-password");
    changePasswordForm.password().value.set("new-password123");
    changePasswordForm.passwordConfirmation().value.set("different123");

    expect(changePasswordForm.passwordConfirmation().invalid()).toBe(true);
  });

  it("changes the password and closes the dialog", async () => {
    changePassword.mockReturnValue(
      of({ message: "Contraseña actualizada correctamente." }),
    );

    const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    const { changePasswordForm } = fixture.componentInstance;
    fixture.detectChanges();

    changePasswordForm.currentPassword().value.set("old-password");
    changePasswordForm.password().value.set("new-password123");
    changePasswordForm.passwordConfirmation().value.set("new-password123");
    await fixture.componentInstance.save();

    expect(changePassword).toHaveBeenCalledWith(
      "old-password",
      "new-password123",
      "new-password123",
    );
    expect(success).toHaveBeenCalledWith(
      "Contraseña actualizada correctamente.",
    );
    expect(close).toHaveBeenCalledWith(true);
  });

  it("keeps the dialog open when the request fails", async () => {
    changePassword.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { error: "Contraseña actual incorrecta." },
          }),
      ),
    );

    const fixture = TestBed.createComponent(ChangePasswordDialogComponent);
    const { changePasswordForm } = fixture.componentInstance;
    fixture.detectChanges();

    changePasswordForm.currentPassword().value.set("wrong-password");
    changePasswordForm.password().value.set("new-password123");
    changePasswordForm.passwordConfirmation().value.set("new-password123");
    await fixture.componentInstance.save();

    expect(success).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
