import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { AuthApi } from "../../core/auth/auth.api";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { ActivateAccountComponent } from "./activate-account.component";

describe("ActivateAccountComponent", () => {
  const activateAccount = vi.fn();
  const success = vi.fn();
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  function setup(inputs: { email?: string; code?: string } = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: AuthApi, useValue: { activateAccount } },
        { provide: SnackbarService, useValue: { success } },
      ],
    });
    navigateByUrl = vi
      .spyOn(TestBed.inject(Router), "navigateByUrl")
      .mockResolvedValue(true);

    const fixture = TestBed.createComponent(ActivateAccountComponent);
    fixture.componentRef.setInput("email", inputs.email ?? "ana@example.com");
    fixture.componentRef.setInput("code", inputs.code ?? "abc123");
    fixture.detectChanges();

    return fixture;
  }

  function fill(
    fixture: ReturnType<typeof setup>,
    password: string,
    confirmation: string,
  ) {
    const { activateForm } = fixture.componentInstance;
    activateForm.password().value.set(password);
    activateForm.passwordConfirmation().value.set(confirmation);
  }

  beforeEach(() => {
    activateAccount.mockReset();
    success.mockReset();
  });

  it("activates the account with the link's email and code, then goes to the login", async () => {
    activateAccount.mockReturnValue(of({ message: "Cuenta activada." }));
    const fixture = setup();
    fill(fixture, "password123", "password123");

    await fixture.componentInstance.activate();

    expect(activateAccount).toHaveBeenCalledWith(
      "ana@example.com",
      "abc123",
      "password123",
      "password123",
    );
    expect(success).toHaveBeenCalledWith("Cuenta activada.");
    expect(navigateByUrl).toHaveBeenCalledWith("/");
  });

  it("shows the error and asks for a new invitation when the code is rejected", async () => {
    activateAccount.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { error: "Código inválido o expirado." },
          }),
      ),
    );
    const fixture = setup();
    fill(fixture, "password123", "password123");

    await fixture.componentInstance.activate();
    fixture.detectChanges();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "Código inválido o expirado.",
    );
    expect(fixture.nativeElement.textContent).toContain(
      "Pide una nueva invitación al administrador.",
    );
  });

  it("does not submit passwords that don't match", async () => {
    const fixture = setup();
    fill(fixture, "password123", "different123");

    await fixture.componentInstance.activate();

    expect(
      fixture.componentInstance.activateForm.passwordConfirmation().invalid(),
    ).toBe(true);
    expect(activateAccount).not.toHaveBeenCalled();
  });

  it("does not submit a short password", async () => {
    const fixture = setup();
    fill(fixture, "short", "short");

    await fixture.componentInstance.activate();

    expect(activateAccount).not.toHaveBeenCalled();
  });

  it("asks for the email and code when the link has none, and submits what was typed", async () => {
    activateAccount.mockReturnValue(of({ message: "Cuenta activada." }));
    const fixture = setup({ email: "", code: "" });
    const { activateForm } = fixture.componentInstance;

    expect(fixture.nativeElement.querySelector("form")).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll("input")).toHaveLength(4);

    fill(fixture, "password123", "password123");
    await fixture.componentInstance.activate();
    expect(activateAccount).not.toHaveBeenCalled();
    expect(activateForm.email().invalid()).toBe(true);
    expect(activateForm.code().invalid()).toBe(true);

    activateForm.email().value.set("ana@example.com");
    activateForm.code().value.set("12345");
    expect(activateForm.code().invalid()).toBe(true);

    activateForm.code().value.set("456468");
    await fixture.componentInstance.activate();

    expect(activateAccount).toHaveBeenCalledWith(
      "ana@example.com",
      "456468",
      "password123",
      "password123",
    );
  });

  it("shows the manual fields when the router binds no query params (undefined)", () => {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: AuthApi, useValue: { activateAccount } },
        { provide: SnackbarService, useValue: { success } },
      ],
    });
    const fixture = TestBed.createComponent(ActivateAccountComponent);
    fixture.componentRef.setInput("email", undefined);
    fixture.componentRef.setInput("code", undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll("input")).toHaveLength(4);
  });

  it("does not show the email and code fields when the link has them", () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelectorAll("input")).toHaveLength(2);
  });
});
