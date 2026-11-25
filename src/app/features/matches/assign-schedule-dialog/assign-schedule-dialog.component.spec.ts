import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { SchedulePhase, SchedulePreview } from "../schedule.model";
import { ScheduleApi } from "../schedule.api";
import { AssignScheduleDialogComponent } from "./assign-schedule-dialog.component";

const PREVIEW: SchedulePreview = {
  seed: 1,
  scheduled: 2,
  unscheduled: 1,
  locked_kept: 0,
  played_kept: 0,
  assigned_kept: 0,
  warnings: [],
  matchdays: [
    {
      matchday: 1,
      week_start: "2026-12-05",
      week_end: "2026-12-06",
      matches: 3,
      scheduled: 2,
      unscheduled: 1,
    },
  ],
  rounds: [
    {
      liguilla: "Oro",
      round_name: "Semifinal",
      leg: 1,
      date: "2026-12-20",
      matches: 2,
      scheduled: 1,
      unscheduled: 1,
    },
  ],
  matches: [
    {
      id: 1,
      matchday: 1,
      group: "A",
      round_name: "Semifinal",
      leg: 1,
      home_team: "Águilas",
      away_team: "Búhos",
      match_datetime: "2026-12-05T09:00:00",
      field: { id: 1, name: "Cancha 1" },
    },
    {
      id: 2,
      matchday: 1,
      group: "B",
      home_team: "Cóndores",
      away_team: "Delfines",
      match_datetime: null,
      field: null,
    },
  ],
};

describe("AssignScheduleDialogComponent", () => {
  const updateSize = vi.fn();

  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function () {
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  function setup(mobile: boolean, phase: SchedulePhase = "regular") {
    updateSize.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
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
        { provide: ScheduleApi, useValue: { preview: () => of(PREVIEW) } },
        { provide: SnackbarService, useValue: {} },
        { provide: MatDialogRef, useValue: { updateSize, close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { tournamentId: 1, phase },
        },
      ],
    });

    const fixture = TestBed.createComponent(AssignScheduleDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.calculate();
    fixture.detectChanges();

    return fixture;
  }

  it("does not resize the playoffs dialog on a phone", () => {
    setup(true, "playoffs");

    expect(updateSize).not.toHaveBeenCalled();
  });

  it("widens the playoffs dialog on desktop", () => {
    setup(false, "playoffs");

    expect(updateSize).toHaveBeenCalledWith("960px");
  });

  it("on phones the rounds are cards, on desktop a table", () => {
    const phone: HTMLElement = setup(true, "playoffs").nativeElement;
    expect(phone.querySelector("table")).toBeNull();
    expect(phone.querySelector("ul dl")?.textContent).toContain("Partidos");
    expect(phone.textContent).toContain("Semifinal (ida)");
    expect(phone.textContent).toContain("20/12/2026");

    TestBed.resetTestingModule();
    const desktop: HTMLElement = setup(false, "playoffs").nativeElement;
    expect(desktop.querySelector("table")).not.toBeNull();
  });

  it("puts the counts under the title of each matchday on phones, with the pending ones", () => {
    const host: HTMLElement = setup(true).nativeElement;
    const header = host.querySelector("mat-expansion-panel-header")!;

    expect(header.querySelector(".pl-\\[52px\\]")?.textContent).toContain(
      "3 partidos",
    );
    expect(header.textContent).toContain("1 sin horario");
    expect(header.querySelector("app-scroll-fade")).toBeNull();
  });

  it("stacks the teams of each match and shows its group when there are several", () => {
    const host: HTMLElement = setup(true).nativeElement;
    const items = [...host.querySelectorAll("mat-expansion-panel li")];

    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Águilas");
    expect(items[0].textContent).toContain("A");
    expect(items[0].textContent).toContain("Cancha 1");
    expect(items[1].textContent).toContain("Sin horario");
    expect(items[0].querySelector("mat-icon")).toBeNull();
  });
});
