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
import { Tournament } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { GroupsApi } from "../groups.api";
import { GroupsPageComponent } from "./groups-page.component";

describe("GroupsPageComponent", () => {
  beforeEach(() => {
    // The scroll fade watches its size; jsdom has no ResizeObserver
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  const region = (id: number, teams: number) => ({
    id,
    name: `Grupo ${id}`,
    type: "regular_stage",
    teams_count: teams,
    teams: [],
  });
  const playoffOf = (sourceGroup: number) => ({
    id: 90,
    name: "Oro",
    type: "playoff",
    sources: [{ id: 1, source_group_id: sourceGroup }],
  });

  function setup(
    status: Tournament["status"],
    regular = [region(1, 0), region(2, 3)],
    playoffs: unknown[] = [],
    mobile = true,
  ) {
    const league = { id: 1, name: "Liga" } as MyLeague;
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
              value: () => ({ data: [{ id: 1, name: "T1", status }] }),
            }),
          },
        },
        {
          provide: GroupsApi,
          useValue: {
            view: () => ({
              isLoading: signal(false),
              error: signal(undefined),
              reload: vi.fn(),
              value: signal({ regular, playoffs }),
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

    const fixture = TestBed.createComponent(GroupsPageComponent);
    fixture.componentInstance.picker.set({ tournament: 1 });
    fixture.detectChanges();

    return fixture;
  }

  it("offers to rename a group, and to delete it when it can go", () => {
    const page = setup("planning").componentInstance;
    const [rename, del] = page.groupActions(page.regular()[0]);

    expect(rename).toMatchObject({
      labelKey: "groups.actions.rename",
      labelParams: { name: "Grupo 1" },
    });
    expect(del).toMatchObject({
      labelKey: "groups.actions.delete",
      danger: true,
      divider: true,
      disabled: false,
      hint: undefined,
    });
  });

  it("disables the delete of a group that has teams and says why", () => {
    const page = setup("planning").componentInstance;
    const [, del] = page.groupActions(page.regular()[1]);

    expect(del.disabled).toBe(true);
    expect(del.hint).toBeTruthy();
    expect(del.hint).not.toContain("groups.");
  });

  it("disables the delete of a group a playoff takes teams from", () => {
    const page = setup(
      "planning",
      [region(1, 0), region(2, 0)],
      [playoffOf(1)],
    ).componentInstance;
    const [, del] = page.groupActions(page.regular()[0]);

    expect(del.disabled).toBe(true);
  });

  it("has no group menu when the tournament is not in planning", () => {
    const fixture = setup("in_progress");

    expect(
      fixture.componentInstance.groupActions(
        fixture.componentInstance.regular()[0],
      ),
    ).toEqual([]);
  });

  it("offers edit and delete for a playoff that can change, and nothing otherwise", () => {
    const open = setup("in_progress", undefined, [
      playoffOf(1),
    ]).componentInstance;
    const [edit, del] = open.playoffActions(open.playoffs()[0]);

    expect(edit.labelKey).toBe("groups.actions.edit");
    expect(del).toMatchObject({
      labelKey: "groups.actions.delete",
      danger: true,
      divider: true,
    });

    TestBed.resetTestingModule();
    const locked = setup("playoffs", undefined, [
      playoffOf(1),
    ]).componentInstance;
    expect(locked.playoffActions(locked.playoffs()[0])).toEqual([]);
  });

  it("stacks the cards on phones and keeps the strip on desktop", () => {
    const phone = setup("planning").componentInstance;
    expect(phone.cardsClass()).toContain("flex-col");
    expect(phone.cardBasis()).toBeNull();

    TestBed.resetTestingModule();
    const desktop = setup("planning", undefined, [], false).componentInstance;
    expect(desktop.cardsClass()).toContain("overflow-x-auto");
    expect(desktop.cardBasis()).toContain("18rem");
  });
});
