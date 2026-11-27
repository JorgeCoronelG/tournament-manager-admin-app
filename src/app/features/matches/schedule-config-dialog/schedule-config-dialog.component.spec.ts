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
import { FieldsApi } from "../../fields/fields.api";
import { Capacity, ScheduleConfig } from "../schedule-config.model";
import { ScheduleConfigApi } from "../schedule-config.api";
import {
  ScheduleConfigDialogComponent,
  ScheduleConfigDialogData,
} from "./schedule-config-dialog.component";

const CONFIG: ScheduleConfig = {
  schedule_start_date: "2026-12-01",
  windows: [
    {
      weekday: 6,
      field: { id: 1, name: "Cancha 1" },
      start_time: "08:00",
      end_time: "12:00",
    },
  ],
  blocks: [],
  match_duration_minutes: 60,
};

const CAPACITY: Capacity = {
  weeks: [],
  has_calendar: true,
  schedule_outdated: false,
  locked_outside_schedule: 2,
  matchdays: [
    {
      matchday: 1,
      week: 1,
      start_date: "2026-12-05",
      end_date: "2026-12-06",
      matches_required: 4,
      slots_configured: 3,
      slots_available: 3,
      deficit: 1,
    },
    {
      matchday: 2,
      week: 2,
      start_date: "2026-12-12",
      end_date: "2026-12-13",
      matches_required: 2,
      slots_configured: 4,
      slots_available: 4,
      deficit: 0,
    },
  ],
};

describe("ScheduleConfigDialogComponent", () => {
  function setup(
    mobile: boolean,
    data: Partial<ScheduleConfigDialogData> = {},
  ) {
    const resource = <T>(value: T) => ({
      hasValue: () => true,
      value: () => value,
      isLoading: signal(false),
      error: signal(undefined),
      reload: vi.fn(),
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
          provide: ScheduleConfigApi,
          useValue: {
            config: () => resource(CONFIG),
            capacity: () => resource(CAPACITY),
            previewCapacity: () => of(CAPACITY),
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
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tournamentId: 1,
            matchDuration: 60,
            tournamentStartDate: "2026-12-01",
            ...data,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ScheduleConfigDialogComponent);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it("on phones the capacity is a card per matchday, not a table", () => {
    const host = setup(true);

    expect(host.querySelector("table")).toBeNull();
    const cards = [...host.querySelectorAll("li")];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Partidos");
    expect(cards[0].textContent).toContain("Déficit");
    // amber with a deficit, green without it
    expect(cards[0].querySelector("dd.text-amber-800")?.textContent).toContain(
      "1",
    );
    expect(cards[1].querySelector("dd.text-green-800")?.textContent).toContain(
      "0",
    );
  });

  it("on desktop the capacity stays a table", () => {
    const host = setup(false);

    expect(host.querySelector("table")).not.toBeNull();
    expect(host.querySelectorAll("dl")).toHaveLength(0);
  });

  it("on phones writes the hints the tooltips carry on desktop", () => {
    const text = setup(true).textContent ?? "";

    expect(text).toContain("Define los horarios generales de cada día");
    expect(text).toContain("Restablecer al horario general del día");
    expect(text).toContain("Estos partidos conservarán su horario");
  });

  it("on desktop leaves the hints in tooltips", () => {
    const text = setup(false).textContent ?? "";

    expect(text).not.toContain("Define los horarios generales de cada día");
    expect(text).not.toContain("Restablecer al horario general del día");
  });

  it("on phones the buttons that were icons carry their text", () => {
    const host = setup(true);
    const buttons = [...host.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    );

    expect(buttons).toEqual(
      expect.arrayContaining([
        "Agregar día",
        "Agregar bloqueo",
        "Calcular capacidad",
      ]),
    );
  });
});
