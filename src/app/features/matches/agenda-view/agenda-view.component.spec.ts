import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { RefereesApi } from "../../referees/referees.api";
import { Tournament } from "../../tournaments/tournament.model";
import { AgendaMatch } from "../agenda.model";
import { AgendaApi } from "../agenda.api";
import { AgendaViewComponent } from "./agenda-view.component";

const match = (
  id: number,
  datetime: string,
  extra: Partial<AgendaMatch> = {},
): AgendaMatch => ({
  id,
  tournament: { id: 1, name: "Torneo 1" },
  phase: "regular",
  round_label: "Jornada 1",
  group: "A",
  home_team: `Local ${id}`,
  away_team: `Visita ${id}`,
  match_datetime: datetime,
  end_datetime: datetime,
  field: { id: 1, name: "Cancha 1" },
  referee: null,
  status: "scheduled",
  schedule_locked: false,
  ...extra,
});

describe("AgendaViewComponent on phones", () => {
  function setup(
    matches: AgendaMatch[],
    status: Tournament["status"] = "in_progress",
  ) {
    const league = { id: 1, name: "Liga" };
    const days = matches.length
      ? [{ date: matches[0].match_datetime.slice(0, 10), matches }]
      : [];
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
              of({ matches: q.includes("599"), breakpoints: {} }),
            isMatched: (q: string) => q.includes("599"),
          },
        },
        {
          provide: AgendaApi,
          useValue: {
            agenda: () => ({
              hasValue: () => true,
              value: () => ({ days, fields: [] }),
              isLoading: signal(false),
              error: signal(undefined),
              reload: vi.fn(),
            }),
            unscheduled: () => of(0),
          },
        },
        {
          provide: RefereesApi,
          useValue: { list: () => ({ rows: signal([]) }) },
        },
        {
          provide: LeagueContextService,
          useValue: { activeLeague: signal(league), leagueApi: () => "" },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(AgendaViewComponent);
    fixture.componentRef.setInput("tournaments", [
      { id: 1, name: "Torneo 1", status } as Tournament,
    ]);
    fixture.detectChanges();

    return fixture;
  }

  it("sorts a day by hour and then by field", () => {
    const view = setup([
      match(1, "2026-09-19T10:00:00", { field: { id: 2, name: "Cancha 2" } }),
      match(2, "2026-09-19T09:00:00", { field: { id: 2, name: "Cancha 2" } }),
      match(3, "2026-09-19T10:00:00", { field: { id: 1, name: "Cancha 1" } }),
      match(4, "2026-09-19T10:00:00", { field: null }),
    ]).componentInstance;

    expect(view.mobileDays()).toHaveLength(1);
    expect(view.mobileDays()[0].matches.map((m) => m.id)).toEqual([2, 3, 1, 4]);
  });

  it("groups by date, one section per day", () => {
    const view = setup([
      match(1, "2026-09-20T09:00:00"),
      match(2, "2026-09-19T11:00:00"),
      match(3, "2026-09-19T08:00:00"),
    ]).componentInstance;

    expect(
      view.mobileDays().map((day) => [day.date, day.matches.map((m) => m.id)]),
    ).toEqual([
      ["2026-09-19", [3, 2]],
      ["2026-09-20", [1]],
    ]);
  });

  it("counts every active filter, including the one without a referee", () => {
    const view = setup([]).componentInstance;

    expect(view.activeFilters()).toBe(0);
    view.tournament.set(1);
    view.referee.set(2);
    view.field.set(3);
    view.noReferee.set(true);
    expect(view.activeFilters()).toBe(4);

    view.clearFilters();
    expect(view.activeFilters()).toBe(0);
    expect(view.noReferee()).toBe(false);
  });

  describe("cards", () => {
    const cards = (host: HTMLElement) => [
      ...host.querySelectorAll<HTMLButtonElement>("li button"),
    ];

    it("renders a list, not the grid nor the table", () => {
      const host: HTMLElement = setup([
        match(1, "2026-09-19T09:00:00"),
      ]).nativeElement;

      expect(host.querySelector("table")).toBeNull();
      expect(host.querySelector(".overflow-x-auto")).toBeNull();
      expect(cards(host)).toHaveLength(1);
      expect(cards(host)[0].disabled).toBe(false);
      expect(cards(host)[0].textContent).toContain("vs");
    });

    it("shows the score, global and shootout of a played match and disables it", () => {
      const host: HTMLElement = setup([
        match(1, "2026-09-19T09:00:00", {
          status: "played",
          leg: 2,
          home_score: 1,
          away_score: 1,
          global_home: 3,
          global_away: 3,
          home_penalties: 4,
          away_penalties: 3,
        }),
      ]).nativeElement;
      const card = cards(host)[0];

      expect(card.disabled).toBe(true);
      expect(card.textContent).not.toContain("vs");
      expect(card.textContent).toContain("Global: 3 - 3");
      expect(card.textContent).toContain("Penales: 4 - 3");
    });

    it("disables a pending match of a tournament that can no longer be scheduled", () => {
      const host: HTMLElement = setup(
        [match(1, "2026-09-19T09:00:00")],
        "finished",
      ).nativeElement;

      expect(cards(host)[0].disabled).toBe(true);
    });
  });
});
