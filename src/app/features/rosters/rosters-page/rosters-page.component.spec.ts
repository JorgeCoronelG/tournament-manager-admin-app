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
import { Registration } from "../../registrations/registration.model";
import { RegistrationsApi } from "../../registrations/registrations.api";
import { Tournament } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { RosterEntry } from "../roster.model";
import { RostersApi } from "../rosters.api";
import { RostersPageComponent } from "./rosters-page.component";

const entry = (
  status: RosterEntry["status"],
  rejoin: string | null = null,
): RosterEntry => ({
  id: 1,
  player: {
    id: 1,
    first_name: "Ana",
    last_name: "Pérez",
    photo_url: null,
    user_code: "A1",
  },
  jersey_number: 7,
  status,
  requested_at: "2026-01-01T00:00:00.000Z",
  requested_by: null,
  removed_by: null,
  removed_at: null,
  removal_reason: null,
  rejoin_authorized_at: rejoin,
});

describe("RostersPageComponent", () => {
  function setup(mobile: boolean, tournament: Partial<Tournament> = {}) {
    const league = { id: 1, name: "Liga" } as MyLeague;
    const registration = {
      id: 5,
      status: "active",
      team: { id: 5, name: "Halcones", logo_url: null, manager: null },
    } as Registration;
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
            activeOptions: () => ({
              hasValue: () => true,
              value: () => ({
                data: [
                  { id: 1, name: "T1", status: "in_progress", ...tournament },
                ],
              }),
            }),
          },
        },
        {
          provide: RegistrationsApi,
          useValue: {
            all: () => ({
              hasValue: () => true,
              value: () => ({ data: [registration] }),
            }),
          },
        },
        {
          provide: RostersApi,
          useValue: {
            list: () => ({
              resource: {
                isLoading: signal(false),
                error: signal(undefined),
                reload: vi.fn(),
                value: () => ({ summary: { active: 1, max_roster_size: 20 } }),
              },
              rows: signal([entry("active")]),
              total: signal(1),
            }),
          },
        },
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

    const fixture = TestBed.createComponent(RostersPageComponent);
    fixture.componentInstance.picker.set({ tournament: 1 });
    fixture.detectChanges();
    fixture.componentInstance.teamPicker.set({ team: 5 });
    fixture.detectChanges();

    return fixture;
  }

  it("offers 'Quitar' for an active player when the tournament allows it", () => {
    const [action] = setup(true).componentInstance.rowActions(entry("active"));

    expect(action).toMatchObject({
      labelKey: "rosters.actions.remove",
      danger: true,
      disabled: false,
      hint: undefined,
    });
  });

  it("disables 'Quitar' and gives the reason as a hint in the playoffs and when finished", () => {
    const playoffs = setup(true, { status: "playoffs" }).componentInstance;
    const [blocked] = playoffs.rowActions(entry("active"));

    expect(blocked.disabled).toBe(true);
    expect(blocked.hint).toContain("liguilla");

    TestBed.resetTestingModule();
    const finished = setup(true, { status: "finished" }).componentInstance;
    const [done] = finished.rowActions(entry("active"));

    expect(done.disabled).toBe(true);
    expect(done.hint).toContain("terminó");
  });

  it("offers to authorize the rejoin of a removed player, or to revoke it", () => {
    const page = setup(true).componentInstance;
    const [authorize] = page.rowActions(entry("removed"));
    const [revoke] = page.rowActions(entry("removed", "2026-02-01"));

    expect(authorize).toMatchObject({
      labelKey: "rosters.actions.authorize",
      icon: "mat:how_to_reg",
      danger: false,
    });
    expect(revoke).toMatchObject({
      labelKey: "rosters.actions.revoke",
      icon: "mat:block",
      danger: true,
    });
  });

  it("has no actions, and no '⋮', for any other status", () => {
    const fixture = setup(true);

    for (const status of [
      "pending",
      "rejected",
      "cancelled",
      "released",
    ] as const) {
      expect(fixture.componentInstance.rowActions(entry(status))).toEqual([]);
    }
  });

  it("puts the menu column first on phones and the sticky actions last on desktop", () => {
    expect(setup(true).componentInstance.columns()).toEqual([
      "actionsMenu",
      "photo",
      "player",
      "jersey",
      "status",
      "request",
    ]);

    TestBed.resetTestingModule();
    expect(setup(false).componentInstance.columns()).toEqual([
      "photo",
      "player",
      "jersey",
      "status",
      "request",
      "actions",
    ]);
  });

  it("counts only the status filter in the badge, not the search", () => {
    const page = setup(true).componentInstance;

    page.filtersForm.search().value.set("ana");
    expect(page.activeFilters()).toBe(0);

    page.filtersForm.status().value.set("removed");
    expect(page.activeFilters()).toBe(1);

    page.clearFilters();
    expect(page.activeFilters()).toBe(0);
    expect(page.filters().search).toBe("ana");
  });

  it("shows search and the filters button on phones, and both selects on desktop", () => {
    const phone: HTMLElement = setup(true).nativeElement;
    expect(phone.querySelector("app-filters-toggle")).not.toBeNull();

    TestBed.resetTestingModule();
    const desktop: HTMLElement = setup(false).nativeElement;
    expect(desktop.querySelector("app-filters-toggle")).toBeNull();
    // Tournament, team and status
    expect(
      desktop.querySelectorAll("mat-form-field mat-select").length,
    ).toBeGreaterThanOrEqual(3);
  });
});
