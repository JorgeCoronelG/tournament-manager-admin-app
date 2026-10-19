import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, Subject, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Field } from "../field.model";
import { FieldsApi } from "../fields.api";
import { FieldFormDialogComponent } from "./field-form-dialog.component";

const existing: Field = {
  id: 9,
  league_id: 3,
  name: "Cancha Norte",
  status: "inactive",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("FieldFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();
  const notifyFailure = vi.fn();

  function setup(data: Field | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: FieldsApi, useValue: { create, update } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure },
        },
      ],
    });
    TestBed.overrideComponent(FieldFormDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(FieldFormDialogComponent).componentInstance;
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    update.mockReset().mockReturnValue(of({ id: 9 }));
    close.mockReset();
    notifyFailure.mockReset();
  });

  it("requires the name and does not submit without it", async () => {
    const component = setup();

    await component.save();

    expect(create).not.toHaveBeenCalled();
    expect(component.fieldForm.name().invalid()).toBe(true);
    expect(component.errorText(component.fieldForm.name().errors())).toBe(
      "Este campo es obligatorio",
    );
  });

  it("accepts up to 150 characters", () => {
    const component = setup();
    const { name } = component.fieldForm;

    name().value.set("a".repeat(150));
    expect(name().invalid()).toBe(false);

    name().value.set("a".repeat(151));
    expect(name().invalid()).toBe(true);
    expect(component.errorText(name().errors())).toContain("150");
  });

  it("creates active by default, with the trimmed name, and closes with the result", async () => {
    const component = setup();
    component.fieldForm.name().value.set("  Cancha Sur ");

    await component.save();

    expect(create).toHaveBeenCalledWith({
      name: "Cancha Sur",
      status: "active",
    });
    expect(close).toHaveBeenCalledWith({ id: 1 });
  });

  it("creates with the chosen status", async () => {
    const component = setup();
    component.fieldForm.name().value.set("Cancha Sur");
    component.fieldForm.status().value.set("inactive");

    await component.save();

    expect(create).toHaveBeenCalledWith({
      name: "Cancha Sur",
      status: "inactive",
    });
  });

  it("edits only the name of an existing field", async () => {
    const component = setup(existing);
    expect(component.fieldForm.name().value()).toBe("Cancha Norte");
    component.fieldForm.name().value.set("Cancha Central");

    await component.save();

    expect(update).toHaveBeenCalledWith(9, { name: "Cancha Central" });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not send twice while saving", async () => {
    const pending = new Subject<Field>();
    create.mockReturnValue(pending);
    const component = setup();
    component.fieldForm.name().value.set("Cancha Sur");

    const first = component.save();
    expect(component.fieldForm().submitting()).toBe(true);
    void component.save();
    expect(create).toHaveBeenCalledTimes(1);

    pending.next({ id: 1 } as Field);
    pending.complete();
    await first;

    expect(component.fieldForm().submitting()).toBe(false);
  });

  it("maps a 422 to the name field and keeps the dialog open", async () => {
    create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 422,
              error: { name: ["La cancha ya existe en la liga."] },
            },
          }),
      ),
    );
    const component = setup();
    component.fieldForm.name().value.set("Cancha Norte");

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.errorText(component.fieldForm.name().errors())).toBe(
      "La cancha ya existe en la liga.",
    );
    expect(component.fieldForm().submitting()).toBe(false);
  });

  it("reports other failures in a snackbar", async () => {
    update.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = setup(existing);

    await component.save();

    expect(notifyFailure).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
