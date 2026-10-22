import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { RostersApi } from "../rosters.api";
import { RosterRemoveDialogComponent } from "./roster-remove-dialog.component";

describe("RosterRemoveDialogComponent", () => {
  const remove = vi.fn();
  const close = vi.fn();

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: RostersApi, useValue: { remove } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tournamentId: 8,
            registrationId: 5,
            rosterId: 11,
            player: "Ana Pérez",
            team: "Halcones",
          },
        },
        {
          provide: SnackbarService,
          useValue: {
            failureText: (error: HttpErrorResponse) => error.error.error,
          },
        },
      ],
    });
    TestBed.overrideComponent(RosterRemoveDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(RosterRemoveDialogComponent)
      .componentInstance;
  }

  beforeEach(() => {
    remove.mockReset().mockReturnValue(of({}));
    close.mockReset();
  });

  it("requires a reason of 5 to 255 characters", async () => {
    const component = setup();
    const { removal_reason } = component.removeForm;

    await component.save();
    expect(remove).not.toHaveBeenCalled();
    expect(removal_reason().invalid()).toBe(true);

    removal_reason().value.set("  abc ");
    expect(component.errorText(removal_reason().errors())).toBe(
      "Debe tener al menos 5 caracteres",
    );

    removal_reason().value.set("a".repeat(256));
    expect(removal_reason().invalid()).toBe(true);

    removal_reason().value.set("Falta grave");
    expect(removal_reason().invalid()).toBe(false);
  });

  it("removes the player and closes with true", async () => {
    const component = setup();
    component.removeForm.removal_reason().value.set("Falta grave");

    await component.save();

    expect(remove).toHaveBeenCalledWith(8, 5, 11, "Falta grave");
    expect(close).toHaveBeenCalledWith(true);
  });

  it("keeps the dialog open and shows the backend's refusal", async () => {
    remove.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 422,
              error: "La liguilla ya inició: no se puede quitar a un jugador.",
            },
          }),
      ),
    );
    const component = setup();
    component.removeForm.removal_reason().value.set("Falta grave");

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.serverError()).toContain("La liguilla ya inició");
    expect(component.removeForm().submitting()).toBe(false);
  });
});
