import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { MyLeague } from "../../../core/league-context/my-league.model";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { CurrentUserService } from "../../../core/user/current-user.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { GroupsApi } from "../../groups/groups.api";
import { RegistrationsApi } from "../../registrations/registrations.api";
import { Tournament } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { Match, Schedule } from "../match.model";
import { MatchesApi } from "../matches.api";
import { PlayoffsApi } from "../playoffs.api";
import { ScheduleApi } from "../schedule.api";
import { ScheduleConfigApi } from "../schedule-config.api";
import { StandingsExportService } from "../standings-export/standings-export.service";
import { MatchesPageComponent } from "./matches-page.component";

const side = (id: number) => ({
  registration_id: id,
  team_id: id,
  team_name: `Equipo ${id}`,
  logo_url: null,
});

const match = (status: Match["status"], extra: Partial<Match> = {}): Match =>
  ({
    id: 1,
    group_id: 1,
    group_name: "A",
    matchday: 1,
    round_number: 1,
    status,
    match_datetime: null,
    home: side(1),
    away: side(2),
    home_score: null,
    away_score: null,
    ...extra,
  }) as Match;

const scheduleOf = (matches: Match[]): Schedule =>
  ({
    generated: true,
    groups: [
      {
        group_id: 1,
        group_name: "A",
        matchdays: [{ matchday: 1, matches, resting: [] }],
      },
    ],
  }) as unknown as Schedule;

describe("MatchesPageComponent", () => {
  function setup({
    mobile = true,
    status = "in_progress",
    matches = [match("scheduled")],
    withdrawn = [] as number[],
    playoffs = [] as unknown[],
  }: {
    mobile?: boolean;
    status?: Tournament["status"];
    matches?: Match[];
    withdrawn?: number[];
    playoffs?: unknown[];
  } = {}) {
    const league = { id: 1, name: "Liga" } as MyLeague;
    const resource = (value: unknown) => ({
      hasValue: () => true,
      value: () => value,
      isLoading: signal(false),
      error: signal(undefined),
      reload: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (q: string) =>
              of({ matches: mobile && q.includes("599"), breakpoints: {} }),
            isMatched: (q: string) => mobile && q.includes("599"),
          },
        },
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: TournamentsApi,
          useValue: {
            options: () => resource({ data: [{ id: 1, name: "T1", status }] }),
          },
        },
        {
          provide: MatchesApi,
          useValue: { schedule: () => resource(scheduleOf(matches)) },
        },
        {
          provide: PlayoffsApi,
          useValue: { bracket: () => resource({ playoffs: [] }) },
        },
        {
          provide: GroupsApi,
          useValue: { view: () => ({ value: () => ({ playoffs }) }) },
        },
        {
          provide: RegistrationsApi,
          useValue: {
            all: () =>
              resource({
                data: withdrawn.map((id) => ({ id, status: "withdrawn" })),
              }),
          },
        },
        { provide: ScheduleApi, useValue: {} },
        {
          provide: ScheduleConfigApi,
          useValue: {
            config: () => resource({ windows: [] }),
            capacity: () => resource({ locked_outside_schedule: 0 }),
          },
        },
        { provide: StandingsExportService, useValue: {} },
        {
          provide: LeagueContextService,
          useValue: {
            activeLeague: signal(league),
            activeLeagueId: () => 1,
            leagues: signal([league]),
            isLoading: signal(false),
            error: signal(undefined),
            reload: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: ConfirmDialogService, useValue: { confirm: vi.fn() } },
        { provide: SnackbarService, useValue: {} },
      ],
    });
    TestBed.inject(CurrentUserService).setUser({
      id: 1,
      name: "Ada",
      role: "",
      roles: ["league_admin"],
      avatarUrl: null,
    });

    const fixture = TestBed.createComponent(MatchesPageComponent);
    fixture.componentInstance.picker.set({ tournament: 1 });
    fixture.detectChanges();

    return fixture;
  }

  const labels = (actions: Array<{ labelKey: string }>) =>
    actions.map((action) => action.labelKey.split(".").slice(-2).join("."));

  it("offers program, walkover and result for a scheduled match with both teams", () => {
    const page = setup().componentInstance;

    expect(labels(page.matchActions(match("scheduled")))).toEqual([
      "program.action",
      "walkover.action",
      "result.editTooltip",
    ]);
  });

  it("offers only the result for a played match", () => {
    const page = setup().componentInstance;

    expect(labels(page.matchActions(match("played")))).toEqual([
      "result.editTooltip",
    ]);
  });

  it("offers no walkover while a team is still unknown", () => {
    const page = setup().componentInstance;

    expect(
      labels(page.matchActions(match("scheduled", { away: null }))),
    ).toEqual(["program.action", "result.editTooltip"]);
  });

  it("disables the result of a match with a withdrawn team and says why", () => {
    const page = setup({ withdrawn: [2] }).componentInstance;
    const result = page
      .matchActions(match("scheduled"))
      .find((action) => action.labelKey === "matches.result.editTooltip");

    expect(result?.disabled).toBe(true);
    expect(result?.hint).toContain("Ganado por default");

    TestBed.resetTestingModule();
    const ok = setup()
      .componentInstance.matchActions(match("scheduled"))
      .at(-1);
    expect(ok?.disabled).toBe(false);
    expect(ok?.hint).toBeUndefined();
  });

  it("has no match menu when the calendar cannot change", () => {
    const page = setup({ status: "playoffs" }).componentInstance;

    expect(page.matchActions(match("scheduled"))).toEqual([]);
  });

  it("offers regenerate and delete, and closing the phase when the playoffs wait for it", () => {
    const plain = setup().componentInstance.calendarActions();
    expect(labels(plain)).toEqual(["regenerate.action", "delete.action"]);
    expect(plain[1]).toMatchObject({ danger: true, divider: true });

    TestBed.resetTestingModule();
    const closing = setup({ playoffs: [{ id: 9 }] }).componentInstance;
    expect(labels(closing.calendarActions())).toEqual([
      "regenerate.action",
      "close.action",
      "delete.action",
    ]);
  });

  it("disables regenerate and delete once matches were played, with the reason as a hint", () => {
    const page = setup({ matches: [match("played")] }).componentInstance;
    const actions = page.calendarActions();

    expect(actions.every((action) => action.disabled)).toBe(true);
    expect(actions[0].hint).toContain("finalizados");
  });

  it("has no calendar menu outside a tournament in progress", () => {
    expect(
      setup({ status: "playoffs" }).componentInstance.calendarActions(),
    ).toEqual([]);
  });

  it("shows the match menu button on phones and the desktop icons otherwise", () => {
    const phone: HTMLElement = setup().nativeElement;
    expect(phone.querySelector("li app-row-actions")).not.toBeNull();

    TestBed.resetTestingModule();
    const desktop: HTMLElement = setup({ mobile: false }).nativeElement;
    expect(desktop.querySelector("li app-row-actions")).toBeNull();
  });
});
