import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Referee } from "../referee.model";
import { RefereesApi } from "../referees.api";
import { RefereeEditDialogComponent } from "./referee-edit-dialog.component";

const referee = {
  id: 9,
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.com",
  phone: "5512345678",
} as Referee;

describe("RefereeEditDialogComponent", () => {
  const update = vi.fn();
  const close = vi.fn();
  const notifyFailure = vi.fn();

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: RefereesApi, useValue: { update } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: referee },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure },
        },
      ],
    });
    TestBed.overrideComponent(RefereeEditDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(RefereeEditDialogComponent)
      .componentInstance;
  }

  beforeEach(() => {
    update.mockReset().mockReturnValue(of({ id: 9 }));
    close.mockReset();
    notifyFailure.mockReset();
  });

  it("starts with the referee's data and saves it", async () => {
    const component = setup();
    component.refereeForm.last_name().value.set("  López ");
    component.refereeForm.phone().value.set("");

    await component.save();

    expect(update).toHaveBeenCalledWith(9, {
      first_name: "Ana",
      last_name: "López",
      email: "ana@example.com",
      phone: null,
    });
    expect(close).toHaveBeenCalledWith({ id: 9 });
  });

  it("validates names, email and phone", async () => {
    const component = setup();
    const f = component.refereeForm;
    f.first_name().value.set("A");
    f.email().value.set("nope");
    f.phone().value.set("123");

    await component.save();

    expect(update).not.toHaveBeenCalled();
    expect(f.first_name().invalid()).toBe(true);
    expect(f.email().invalid()).toBe(true);
    expect(f.phone().invalid()).toBe(true);
    expect(component.errorText(f.phone().errors(), "123")).toBe(
      "Ingresa un teléfono de 10 dígitos, solo números",
    );
  });

  it("maps 422 errors to their fields and explains that only the referee can change their data", async () => {
    update.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 422, error: { email: ["El correo ya existe."] } },
          }),
      ),
    );
    const component = setup();

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.rejected()).toBe(true);
    expect(
      component.errorText(component.refereeForm.email().errors(), ""),
    ).toBe("El correo ya existe.");
  });

  it("reports other failures in a snackbar without the explanation", async () => {
    update.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = setup();

    await component.save();

    expect(notifyFailure).toHaveBeenCalled();
    expect(component.rejected()).toBe(false);
  });
});
