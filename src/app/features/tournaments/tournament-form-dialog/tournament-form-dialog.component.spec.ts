import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Tournament } from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";
import { TournamentFormDialogComponent } from "./tournament-form-dialog.component";

const existing = (status: Tournament["status"] = "planning"): Tournament => ({
  id: 9,
  league_id: 3,
  name: "Apertura",
  gender: "male",
  min_age: 18,
  max_age: 35,
  start_date: "2026-03-01",
  max_roster_size: 12,
  min_matches_for_playoffs: null,
  playoffs_started: false,
  status,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("TournamentFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();
  const notifyFailure = vi.fn();

  function setup(data: Tournament | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: TournamentsApi, useValue: { create, update } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure },
        },
      ],
    });
    TestBed.overrideComponent(TournamentFormDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(TournamentFormDialogComponent)
      .componentInstance;
  }

  function fill(component: TournamentFormDialogComponent) {
    const f = component.tournamentForm;
    f.name().value.set("  Clausura ");
    f.gender().value.set("mixed");
    f.start_date().value.set(new Date(2026, 4, 9));
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    update.mockReset().mockReturnValue(of({ id: 9 }));
    close.mockReset();
    notifyFailure.mockReset();
  });

  it("does not submit an empty form", async () => {
    const component = setup();

    await component.save();

    expect(create).not.toHaveBeenCalled();
    const f = component.tournamentForm;
    expect(f.name().invalid()).toBe(true);
    expect(f.gender().invalid()).toBe(true);
    expect(f.start_date().invalid()).toBe(true);
    expect(f.min_age().invalid()).toBe(false);
    expect(f.max_age().invalid()).toBe(false);
  });

  it("keeps ages between 18 and 99", () => {
    const component = setup();
    const { min_age, max_age } = component.tournamentForm;

    min_age().value.set(17);
    max_age().value.set(100);
    expect(min_age().invalid()).toBe(true);
    expect(max_age().invalid()).toBe(true);
    expect(component.errorText(min_age().errors())).toBe(
      "Ingresa una edad entre 18 y 99",
    );

    min_age().value.set(18);
    max_age().value.set(99);
    expect(min_age().invalid()).toBe(false);
    expect(max_age().invalid()).toBe(false);
  });

  it("requires the minimum age not to exceed the maximum", () => {
    const component = setup();
    const { min_age, max_age } = component.tournamentForm;

    min_age().value.set(40);
    max_age().value.set(30);
    expect(max_age().invalid()).toBe(true);
    expect(component.errorText(max_age().errors())).toBe(
      "La edad máxima no puede ser menor que la mínima",
    );

    max_age().value.set(40);
    expect(max_age().invalid()).toBe(false);
  });

  it("creates the tournament with a Y-m-d date and closes with it", async () => {
    const component = setup();
    fill(component);

    await component.save();

    expect(create).toHaveBeenCalledWith({
      name: "Clausura",
      gender: "mixed",
      min_age: null,
      max_age: null,
      start_date: "2026-05-09",
      max_roster_size: null,
      min_matches_for_playoffs: null,
    });
    expect(close).toHaveBeenCalledWith({ id: 1 });
  });

  it("edits an existing tournament", async () => {
    const component = setup(existing());

    expect(component.tournamentForm.start_date().value()).toEqual(
      new Date(2026, 2, 1),
    );
    await component.save();

    expect(update).toHaveBeenCalledWith(9, {
      name: "Apertura",
      gender: "male",
      min_age: 18,
      max_age: 35,
      start_date: "2026-03-01",
      max_roster_size: 12,
      min_matches_for_playoffs: null,
    });
  });

  it("requires roster fields to be positive integers", () => {
    const component = setup();
    const { max_roster_size, min_matches_for_playoffs } =
      component.tournamentForm;

    for (const field of [max_roster_size, min_matches_for_playoffs]) {
      for (const bad of [0, -1, 2.5]) {
        field().value.set(bad);
        expect(field().invalid()).toBe(true);
        expect(component.errorText(field().errors())).toBe(
          "Debe ser un número entero mayor a 0",
        );
      }
      field().value.set(3);
      expect(field().invalid()).toBe(false);
      field().value.set(null);
      expect(field().invalid()).toBe(false);
    }
  });

  it("enables every field while planning", () => {
    const f = setup(existing("planning")).tournamentForm;

    expect(f.gender().disabled()).toBe(false);
    expect(f.min_age().disabled()).toBe(false);
    expect(f.max_age().disabled()).toBe(false);
    expect(f.start_date().disabled()).toBe(false);
  });

  it("only enables the name while in progress", () => {
    const f = setup(existing("in_progress")).tournamentForm;

    expect(f.name().disabled()).toBe(false);
    expect(f.gender().disabled()).toBe(true);
    expect(f.min_age().disabled()).toBe(true);
    expect(f.max_age().disabled()).toBe(true);
    expect(f.start_date().disabled()).toBe(true);
    expect(f.max_roster_size().disabled()).toBe(true);
    expect(f.min_matches_for_playoffs().disabled()).toBe(true);
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
                name: ["El nombre ya existe en la liga."],
                start_date: ["La fecha no es válida."],
              },
            },
          }),
      ),
    );
    const component = setup();
    fill(component);

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.errorText(component.tournamentForm.name().errors())).toBe(
      "El nombre ya existe en la liga.",
    );
    expect(
      component.errorText(component.tournamentForm.start_date().errors()),
    ).toBe("La fecha no es válida.");
    expect(component.tournamentForm().submitting()).toBe(false);
  });

  it("reports other failures in a snackbar", async () => {
    create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = setup();
    fill(component);

    await component.save();

    expect(notifyFailure).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
