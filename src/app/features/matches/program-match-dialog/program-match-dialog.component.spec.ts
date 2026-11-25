import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { FieldsApi } from "../../fields/fields.api";
import { Match } from "../match.model";
import { MatchScheduleApi } from "../match-schedule.api";
import { ProgramMatchDialogComponent } from "./program-match-dialog.component";

const side = (id: number, name: string) => ({
  registration_id: id,
  team_id: id,
  team_name: name,
  logo_url: null,
});

const match = (id: number, at: string | null): Match =>
  ({
    id,
    group_id: 1,
    group_name: "A",
    matchday: 1,
    round_number: 1,
    status: "scheduled",
    match_datetime: at,
    field: at ? { id: 1, name: "Cancha 1" } : null,
    home: side(id * 2, `Local ${id}`),
    away: side(id * 2 + 1, `Visita ${id}`),
    home_score: null,
    away_score: null,
  }) as Match;

const SLOTS = Array.from({ length: 9 }, (_, i) => ({
  start_time: `${String(8 + i).padStart(2, "0")}:00`,
  end_time: `${String(9 + i).padStart(2, "0")}:00`,
  field_id: 1,
  field_name: "Cancha 1",
}));

describe("ProgramMatchDialogComponent", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function () {
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  function setup(mobile: boolean, at: string | null = "2026-12-05T09:00:00") {
    const resource = <T>(value: T) => ({
      hasValue: () => true,
      value: () => value,
      isLoading: signal(false),
      error: signal(undefined),
    });
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideNativeDateAdapter(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (q: string) =>
              of({ matches: mobile && q.includes("599"), breakpoints: {} }),
            isMatched: (q: string) => mobile && q.includes("599"),
          },
        },
        {
          provide: MatchScheduleApi,
          useValue: {
            availableSlots: () =>
              resource({ date: "2026-12-05", slots: SLOTS }),
            availableReferees: () => resource({ referees: [] }),
          },
        },
        {
          provide: FieldsApi,
          useValue: {
            list: () => ({
              rows: signal([{ id: 1, name: "Cancha 1" }]),
              resource: { isLoading: signal(false) },
            }),
          },
        },
        { provide: ConfirmDialogService, useValue: { confirm: vi.fn() } },
        { provide: SnackbarService, useValue: {} },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tournamentId: 1,
            match: match(1, at),
            candidates: [match(2, "2026-12-06T10:00:00"), match(3, null)],
            hasSeveralGroups: true,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProgramMatchDialogComponent);
    fixture.detectChanges();

    return fixture;
  }

  const labels = (host: HTMLElement, selector: string) =>
    [...host.querySelectorAll(selector)].map((b) => b.textContent?.trim());

  it("on phones the swap and clear actions are buttons with text, in two columns", () => {
    const host: HTMLElement = setup(true).nativeElement;
    const row = host.querySelector(".grid.grid-cols-2.gap-2")!;

    expect(labels(row as HTMLElement, "button")).toEqual([
      "Intercambiar",
      "Quitar horario",
    ]);
    expect(host.querySelector("button[mat-icon-button]")).toBeNull();
  });

  it("without a schedule there is only Intercambiar, across both columns", () => {
    const host: HTMLElement = setup(true, null).nativeElement;
    const buttons = host.querySelectorAll(".grid.grid-cols-2.gap-2 button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0].classList).toContain("col-span-2");
  });

  it("on desktop they stay icons with a label", () => {
    const host: HTMLElement = setup(false).nativeElement;

    expect(host.querySelectorAll("button[mat-icon-button]")).toHaveLength(2);
    expect(host.querySelector(".grid.grid-cols-2.gap-2")).toBeNull();
  });

  it("puts the date and the time in two columns and the field below", () => {
    const host: HTMLElement = setup(true).nativeElement;
    const fields = host.querySelectorAll(
      ".grid.grid-cols-2.gap-x-3 > mat-form-field",
    );

    expect(fields).toHaveLength(3);
    expect(fields[2].classList).toContain("col-span-2");
    expect(fields[0].classList).not.toContain("col-span-2");
  });

  it("makes the suggestions touch-sized and keeps them out of a nested scroll", () => {
    const fixture = setup(true);
    const host: HTMLElement = fixture.nativeElement;
    const chip = host.querySelector<HTMLElement>("button[aria-pressed]")!;

    expect(chip.classList).toContain("min-h-10");
    expect(chip.classList).toContain("py-2");

    fixture.componentInstance.slotsExpanded.set(true);
    fixture.detectChanges();
    expect(host.querySelector(".max-h-40")).toBeNull();
    expect(host.querySelectorAll("button[aria-pressed]")).toHaveLength(9);
  });

  it("shows the footer buttons of each view", () => {
    const fixture = setup(true);
    const host: HTMLElement = fixture.nativeElement;
    const footer = () => labels(host, "mat-dialog-actions button");

    expect(footer()).toEqual(["Cancelar", "Guardar"]);

    fixture.componentInstance.openSwap();
    fixture.detectChanges();
    expect(footer()).toEqual(["Volver", "Intercambiar"]);

    fixture.componentInstance.backToEdit();
    fixture.componentInstance.warnings.set(["Aviso"]);
    fixture.detectChanges();
    expect(footer()).toEqual(["Cerrar"]);
  });

  it("lists each swap option in a column with a touch-sized area", () => {
    const fixture = setup(true);
    fixture.componentInstance.openSwap();
    fixture.detectChanges();
    const option = fixture.nativeElement.querySelector(
      "li button[aria-pressed]",
    ) as HTMLElement;

    expect(option.classList).toContain("flex-col");
    expect(option.classList).toContain("min-h-12");
  });
});
