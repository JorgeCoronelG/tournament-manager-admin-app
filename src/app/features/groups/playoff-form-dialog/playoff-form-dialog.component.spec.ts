import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Group } from "../group.model";
import { GroupsApi } from "../groups.api";
import {
  PlayoffFormDialogComponent,
  PlayoffFormDialogData,
} from "./playoff-form-dialog.component";

const groups: Group[] = [
  { id: 1, name: "Grupo A", type: "regular_stage", teams_count: 4 },
  { id: 2, name: "Grupo B", type: "regular_stage", teams_count: 4 },
];

describe("PlayoffFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();

  function setup(data: Partial<PlayoffFormDialogData> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: GroupsApi, useValue: { create, update } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { tournamentId: 7, groups, ...data },
        },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure: vi.fn() },
        },
      ],
    });
    TestBed.overrideComponent(PlayoffFormDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(PlayoffFormDialogComponent)
      .componentInstance;
  }

  function fill(component: PlayoffFormDialogComponent, end = 4) {
    const { name, sources } = component.playoffForm;
    name().value.set(" Oro ");
    sources[0].source_group_id().value.set(1);
    sources[0].position_start().value.set(1);
    sources[0].position_end().value.set(end);
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 9 }));
    update.mockReset().mockReturnValue(of({ id: 9 }));
    close.mockReset();
  });

  it("starts with one source row and 7 days between rounds", () => {
    const component = setup();

    expect(component.playoffForm.sources().value()).toHaveLength(1);
    expect(component.playoffForm.round_interval_days().value()).toBe(7);
    expect(component.total()).toBe(0);
    expect(component.totalValid()).toBe(false);
  });

  it("counts the total live and names the rounds when it is a power of 2", () => {
    const component = setup();
    fill(component, 3);

    expect(component.total()).toBe(3);
    expect(component.totalValid()).toBe(false);
    expect(component.rounds()).toEqual([]);

    component.playoffForm.sources[0].position_end().value.set(8);
    expect(component.total()).toBe(8);
    expect(component.rounds()).toEqual([
      "Cuartos de final",
      "Semifinal",
      "Final",
    ]);
  });

  it("does not save a total that is not a power of 2", async () => {
    const component = setup();
    fill(component, 3);

    await component.save();

    expect(create).not.toHaveBeenCalled();
    expect(component.playoffForm.sources().invalid()).toBe(true);
    expect(component.errorText(component.playoffForm.sources().errors())).toBe(
      "El total debe ser 2, 4, 8, 16 o 32.",
    );
  });

  it("adds rows and keeps at least one", () => {
    const component = setup();

    component.addSource();
    expect(component.playoffForm.sources().value()).toHaveLength(2);

    component.removeSource(0);
    component.removeSource(0);
    expect(component.playoffForm.sources().value()).toHaveLength(1);
  });

  it("creates the playoff with a Y-m-d date and closes with it", async () => {
    const component = setup();
    fill(component);
    component.playoffForm.start_date().value.set(new Date(2026, 8, 20));

    await component.save();

    expect(create).toHaveBeenCalledWith(7, {
      name: "Oro",
      type: "playoff",
      start_date: "2026-09-20",
      round_interval_days: 7,
      round_legs: [1, 1],
      sources: [{ source_group_id: 1, position_start: 1, position_end: 4 }],
    });
    expect(close).toHaveBeenCalledWith({ id: 9 });
  });

  it("sends no date when none is picked", async () => {
    const component = setup();
    fill(component);

    await component.save();

    expect(create.mock.calls[0][1]).toMatchObject({
      start_date: null,
      round_dates: null,
    });
  });

  it("edits an existing playoff with its current values", async () => {
    const playoff: Group = {
      id: 9,
      name: "Oro",
      type: "playoff",
      teams_count: 0,
      start_date: "2026-09-20",
      round_interval_days: 5,
      sources: [
        {
          id: 1,
          source_group_id: 2,
          source_group_name: "Grupo B",
          position_start: 1,
          position_end: 2,
        },
      ],
    };
    const component = setup({ playoff });

    expect(component.playoffForm.start_date().value()).toEqual(
      new Date(2026, 8, 20),
    );
    expect(component.playoffForm.round_interval_days().value()).toBe(5);
    expect(component.total()).toBe(2);

    await component.save();

    expect(update).toHaveBeenCalledWith(
      7,
      9,
      expect.objectContaining({
        round_interval_days: 5,
        sources: [{ source_group_id: 2, position_start: 1, position_end: 2 }],
      }),
    );
  });

  it("shows the backend's message for a rule the form cannot know (overlapping ranges)", async () => {
    create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              error: {
                "sources.1.position_start": ["Se traslapa con otra fuente."],
              },
            },
          }),
      ),
    );
    const component = setup();
    fill(component);

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(component.formError()).toBe("Se traslapa con otra fuente.");
  });

  describe("round dates", () => {
    const day = (n: number) => new Date(2026, 10, n);

    function eight() {
      const component = setup();
      fill(component, 8);
      TestBed.tick();

      return component;
    }

    const legs = (component: PlayoffFormDialogComponent) =>
      component.playoffForm
        .round_legs()
        .value()
        .map((row) => row.legs);

    const dates = (component: PlayoffFormDialogComponent) =>
      component.playoffForm
        .round_dates()
        .value()
        .map((row) => row.date);

    it("has no list of dates without a start date", () => {
      const component = eight();

      expect(component.hasStart()).toBe(false);
      expect(dates(component)).toEqual([null, null, null]);
    });

    it("empties the dates when the start date is cleared", () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();
      component.setRoundDate(1, day(4));
      component.playoffForm.start_date().value.set(null);
      TestBed.tick();

      expect(component.hasStart()).toBe(false);
      expect(dates(component)).toEqual([null, null, null]);
    });

    it("fills one date per round from the start date and the interval", () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();

      expect(dates(component)).toEqual([day(2), day(9), day(16)]);
    });

    it("keeps a date edited by hand and recalculates the others", async () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();
      component.setRoundDate(1, day(4));
      component.playoffForm.round_interval_days().value.set(3);
      TestBed.tick();

      expect(dates(component)).toEqual([day(2), day(4), day(8)]);

      await component.save();

      expect(create.mock.calls[0][1]).toMatchObject({
        round_dates: ["2026-11-02", "2026-11-04", "2026-11-08"],
      });
    });

    it("moves the start date with the first round", () => {
      const component = eight();
      component.setRoundDate(0, day(5));
      TestBed.tick();

      expect(component.playoffForm.start_date().value()).toEqual(day(5));
      expect(dates(component)).toEqual([day(5), day(12), day(19)]);
    });

    it("sends no round dates when none was edited", async () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();

      await component.save();

      expect(create.mock.calls[0][1]).not.toHaveProperty("round_dates");
    });

    it("does not save dates out of order", async () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(10));
      TestBed.tick();
      component.setRoundDate(2, day(11));
      TestBed.tick();

      await component.save();

      expect(create).not.toHaveBeenCalled();
      expect(
        component.errorText(component.playoffForm.round_dates().errors()),
      ).toBe("Las fechas de las rondas deben ir en orden.");
    });

    it("recalculates and warns when the number of rounds changes", () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();
      component.setRoundDate(1, day(4));
      expect(component.roundsChanged()).toBe(false);

      component.playoffForm.sources[0].position_end().value.set(4);
      TestBed.tick();

      expect(dates(component)).toEqual([day(2), day(9)]);
      expect(component.roundsChanged()).toBe(true);
    });

    it("gives every round one match, and a date for each match", () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();

      expect(legs(component)).toEqual([1, 1, 1]);
      expect(component.matchLabels()).toEqual([
        "Cuartos de final",
        "Semifinal",
        "Final",
      ]);
    });

    it("dates home and away matches apart and sends the legs", async () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();
      component.playoffForm.round_legs[1].legs().value.set(2);
      TestBed.tick();

      expect(component.matchLabels()).toEqual([
        "Cuartos de final",
        "Semifinal (ida)",
        "Semifinal (vuelta)",
        "Final",
      ]);
      expect(dates(component)).toEqual([day(2), day(9), day(16), day(23)]);
      expect(component.roundsChanged()).toBe(true);

      await component.save();

      expect(create.mock.calls[0][1]).toMatchObject({ round_legs: [1, 2, 1] });
    });

    it("starts the dates over when a round changes its matches", () => {
      const component = eight();
      component.playoffForm.start_date().value.set(day(2));
      TestBed.tick();
      component.setRoundDate(1, day(4));
      component.playoffForm.round_legs[0].legs().value.set(2);
      TestBed.tick();

      expect(dates(component)).toEqual([day(2), day(9), day(16), day(23)]);
      expect(component.roundsChanged()).toBe(true);
    });

    it("lets the legs be chosen without a start date", async () => {
      const component = eight();
      component.playoffForm.round_legs[2].legs().value.set(2);
      TestBed.tick();

      expect(dates(component)).toEqual([null, null, null, null]);

      await component.save();

      expect(create.mock.calls[0][1]).toMatchObject({
        start_date: null,
        round_dates: null,
        round_legs: [1, 1, 2],
      });
    });

    it("restores the legs and the dates of a saved playoff", () => {
      const component = setup({
        playoff: {
          id: 9,
          name: "Oro",
          type: "playoff",
          teams_count: 0,
          start_date: "2026-11-02",
          round_interval_days: 7,
          round_legs: [2, 1],
          rounds_detail: [
            { name: "Semifinal", legs: 2, dates: ["2026-11-02", "2026-11-09"] },
            { name: "Final", legs: 1, dates: ["2026-11-16"] },
          ],
          sources: [
            {
              id: 1,
              source_group_id: 2,
              source_group_name: "Grupo B",
              position_start: 1,
              position_end: 4,
            },
          ],
        },
      });
      TestBed.tick();

      expect(legs(component)).toEqual([2, 1]);
      expect(dates(component)).toEqual([day(2), day(9), day(16)]);
      expect(component.roundsChanged()).toBe(false);
    });

    it("starts from the saved dates when editing, manual or not", async () => {
      const playoff: Group = {
        id: 9,
        name: "Oro",
        type: "playoff",
        teams_count: 0,
        start_date: "2026-11-02",
        round_interval_days: 7,
        rounds_detail: [
          { name: "Semifinal", legs: 1, dates: ["2026-11-02"] },
          { name: "Final", legs: 1, dates: ["2026-11-04"] },
        ],
        sources: [
          {
            id: 1,
            source_group_id: 2,
            source_group_name: "Grupo B",
            position_start: 1,
            position_end: 4,
          },
        ],
      };
      const component = setup({ playoff });
      TestBed.tick();

      expect(dates(component)).toEqual([day(2), day(4)]);
      expect(component.roundsChanged()).toBe(false);

      await component.save();

      expect(update.mock.calls[0][2]).toMatchObject({
        round_dates: ["2026-11-02", "2026-11-04"],
      });
    });
  });
});
