import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { provideTestI18n } from "../../../testing/i18n";
import { SnackbarService } from "./snackbar.service";

describe("SnackbarService", () => {
  const openFromComponent = vi.fn();

  function shown() {
    const [, config] = openFromComponent.mock.lastCall ?? [];

    return config.data;
  }

  beforeEach(() => {
    openFromComponent.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MatSnackBar, useValue: { openFromComponent } },
      ],
    });
  });

  it("shows a translated success message with the OK action", () => {
    TestBed.inject(SnackbarService).notifySuccess("users.deactivated");

    expect(shown()).toEqual({
      message: "Usuario desactivado",
      variant: "success",
      action: "Aceptar",
    });
  });

  it("shows the backend's message for a failed request", () => {
    TestBed.inject(SnackbarService).notifyFailure(
      new HttpErrorResponse({
        status: 401,
        error: { code: 401, error: "Contraseña actual incorrecta." },
      }),
    );

    expect(shown()).toEqual({
      message: "Contraseña actual incorrecta.",
      variant: "error",
      action: "Aceptar",
    });
  });

  it("falls back to a generic message by status, or a general one", () => {
    const service = TestBed.inject(SnackbarService);

    service.notifyFailure(new HttpErrorResponse({ status: 503 }));
    expect(shown().message).toBe(
      "El servidor tuvo un problema. Inténtalo más tarde.",
    );

    service.notifyFailure(new Error("boom"));
    expect(shown().message).toBe("Algo salió mal.");
  });
});
