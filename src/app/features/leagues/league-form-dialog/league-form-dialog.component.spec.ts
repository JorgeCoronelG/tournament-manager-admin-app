import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { LeagueFormDialogComponent } from "./league-form-dialog.component";
import { League } from "../league.model";
import { LeagueLimitsApi } from "../league-limits.api";
import { LeaguesApi } from "../leagues.api";

describe("LeagueFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();
  const error = vi.fn();
  const notifyFailure = vi.fn();

  function setup(data: League | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: LeaguesApi, useValue: { create, update } },
        {
          provide: LeagueLimitsApi,
          useValue: { ofLeague: () => ({ hasValue: () => false }) },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: SnackbarService, useValue: { error, notifyFailure } },
      ],
    });
    // The manager selector talks to the API on its own; it is not under test here
    TestBed.overrideComponent(LeagueFormDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(LeagueFormDialogComponent).componentInstance;
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    update.mockReset().mockReturnValue(of({ id: 1 }));
    close.mockReset();
    error.mockReset();
    notifyFailure.mockReset();
  });

  it("does not submit an empty form", async () => {
    const component = setup();

    await component.save();

    expect(create).not.toHaveBeenCalled();
    expect(component.leagueForm.name().invalid()).toBe(true);
    expect(component.leagueForm.admin_user_id().invalid()).toBe(true);
  });

  it("requires the manager", async () => {
    const component = setup();
    component.leagueForm.name().value.set("Liga Norte");

    await component.save();

    expect(create).not.toHaveBeenCalled();
    expect(component.leagueForm.name().invalid()).toBe(false);
    expect(component.leagueForm.admin_user_id().invalid()).toBe(true);
  });

  it("limits the name to 150 characters", () => {
    const component = setup();
    const { name } = component.leagueForm;

    name().value.set("a".repeat(150));
    expect(name().invalid()).toBe(false);

    name().value.set("a".repeat(151));
    expect(name().invalid()).toBe(true);
    expect(component.errorText(name().errors())).toBe(
      "No puede tener más de 150 caracteres",
    );
  });

  it("creates the league and closes with it", async () => {
    const component = setup();
    component.leagueForm.name().value.set("  Liga Norte ");
    component.leagueForm.admin_user_id().value.set(7);

    await component.save();

    // A new league starts with one active tournament allowed
    expect(create).toHaveBeenCalledWith({
      name: "Liga Norte",
      admin_user_id: 7,
      max_active_tournaments: 1,
    });
    expect(close).toHaveBeenCalledWith({ id: 1 });
    expect(component.leagueForm().submitting()).toBe(false);
  });

  it("edits an existing league", async () => {
    const component = setup({
      id: 9,
      name: "Liga Sur",
      admin: { id: 4 },
      max_active_tournaments: 3,
    } as League);

    expect(component.leagueForm.admin_user_id().value()).toBe(4);
    expect(component.leagueForm.max_active_tournaments().value()).toBe(3);
    await component.save();

    expect(update).toHaveBeenCalledWith(9, {
      name: "Liga Sur",
      admin_user_id: 4,
      max_active_tournaments: 3,
    });
  });

  it("sends null for a limit set to Sin límite", async () => {
    const component = setup();
    component.leagueForm.name().value.set("Liga Norte");
    component.leagueForm.admin_user_id().value.set(7);
    component.leagueForm.unlimited_tournaments().value.set(true);

    await component.save();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ max_active_tournaments: null }),
    );
  });

  it("asks for a valid number unless the limit is unlimited", () => {
    const component = setup();
    const { max_active_tournaments: tournaments } = component.leagueForm;

    tournaments().value.set(0);
    expect(tournaments().invalid()).toBe(true);

    tournaments().value.set(1);
    expect(tournaments().invalid()).toBe(false);

    tournaments().value.set(null);
    expect(tournaments().invalid()).toBe(true);
    component.leagueForm.unlimited_tournaments().value.set(true);
    expect(tournaments().invalid()).toBe(false);
  });

  it("maps 422 errors to their fields and keeps the dialog open", async () => {
    create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 422,
              error: {
                name: ["El nombre ya existe."],
                admin_user_id: ["El usuario está inactivo."],
              },
            },
          }),
      ),
    );
    const component = setup();
    component.leagueForm.name().value.set("Liga Norte");
    component.leagueForm.admin_user_id().value.set(7);

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.errorText(component.leagueForm.name().errors())).toBe(
      "El nombre ya existe.",
    );
    expect(
      component.errorText(component.leagueForm.admin_user_id().errors()),
    ).toBe("El usuario está inactivo.");
    expect(component.leagueForm().submitting()).toBe(false);
  });

  it("reports other failures in a snackbar", async () => {
    create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = setup();
    component.leagueForm.name().value.set("Liga Norte");
    component.leagueForm.admin_user_id().value.set(7);

    await component.save();

    expect(notifyFailure).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
