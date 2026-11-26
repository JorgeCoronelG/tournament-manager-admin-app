import { signal, WritableSignal } from "@angular/core";
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
import { Tournament } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { Registration } from "../registration.model";
import { RegistrationsApi } from "../registrations.api";
import { RegistrationsPageComponent } from "./registrations-page.component";

const tournament = (id: number, status: Tournament["status"]) =>
  ({ id, name: `Torneo ${id}`, status }) as Tournament;

const registration = (
  id: number,
  status: Registration["status"] = "active",
): Registration => ({
  id,
  status,
  team: { id, name: `Equipo ${id}`, logo_url: null, manager: null },
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("RegistrationsPageComponent", () => {
  let groups: WritableSignal<{
    regular: Array<{ teams: Array<{ id: number }> }>;
  }>;
  let rows: WritableSignal<Registration[]>;

  function setup(mobile: boolean, status: Tournament["status"] = "planning") {
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
              value: () => ({ data: [tournament(1, status)] }),
            }),
          },
        },
        {
          provide: GroupsApi,
          useValue: {
            view: () => ({ value: groups }),
          },
        },
        {
          provide: RegistrationsApi,
          useValue: {
            list: () => ({
              resource: {
                isLoading: signal(false),
                error: signal(undefined),
                reload: vi.fn(),
                value: () => undefined,
              },
              rows,
              total: signal(rows().length),
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

    const fixture = TestBed.createComponent(RegistrationsPageComponent);
    fixture.componentInstance.picker.set({ tournament: 1 });
    fixture.detectChanges();

    return fixture;
  }

  const labels = (page: RegistrationsPageComponent, row: Registration) =>
    page.rowActions(row).map((action) => action.labelKey.split(".").pop());

  beforeEach(() => {
    groups = signal({ regular: [] }) as never;
    rows = signal([registration(1), registration(2, "withdrawn")]);
  });

  it("offers only 'remove' in a tournament in planning", () => {
    const page = setup(true, "planning").componentInstance;

    expect(labels(page, registration(1))).toEqual(["remove"]);
    expect(page.rowActions(registration(1))[0].danger).toBe(true);
  });

  it("offers replace, withdraw and history in progress; replace and history for a withdrawn team", () => {
    const page = setup(true, "in_progress").componentInstance;

    expect(labels(page, registration(1))).toEqual([
      "replace",
      "withdraw",
      "history",
    ]);
    expect(labels(page, registration(2, "withdrawn"))).toEqual([
      "replace",
      "history",
    ]);
  });

  it("offers withdraw and history (no replace) in the playoffs", () => {
    const page = setup(true, "playoffs").componentInstance;

    expect(labels(page, registration(1))).toEqual(["withdraw", "history"]);
  });

  it("has no actions, and no '⋮', in any other status", () => {
    const fixture = setup(true, "finished");

    expect(fixture.componentInstance.rowActions(registration(1))).toEqual([]);
    expect(fixture.nativeElement.querySelector("app-row-actions")).toBeNull();
  });

  it("puts the menu column first on phones and the sticky actions last on desktop", () => {
    expect(setup(true).componentInstance.columns()).toEqual([
      "actionsMenu",
      "logo",
      "team",
      "manager",
      "created_at",
    ]);

    TestBed.resetTestingModule();
    expect(setup(false).componentInstance.columns()).toEqual([
      "logo",
      "team",
      "manager",
      "created_at",
      "actions",
    ]);
  });

  it("adds the group column only with several regular groups", () => {
    groups.set({
      regular: [{ teams: [{ id: 1 }] }, { teams: [{ id: 2 }] }],
    });
    const mobile = setup(true).componentInstance.columns();

    expect(mobile.slice(0, 4)).toEqual([
      "actionsMenu",
      "logo",
      "team",
      "group",
    ]);

    TestBed.resetTestingModule();
    groups.set({
      regular: [{ teams: [{ id: 1 }] }, { teams: [{ id: 2 }] }],
    });
    const desktop = setup(false).componentInstance.columns();
    expect(desktop).toContain("group");
    expect(desktop.at(-1)).toBe("actions");
  });

  it("shows the search and the register button full width on phones, below the picker", () => {
    const el: HTMLElement = setup(true).nativeElement;
    const register = Array.from(el.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Inscribir equipos"),
    );

    expect(register?.classList.contains("max-sm:w-full")).toBe(true);
    expect(el.querySelector("app-filters-toggle")).toBeNull();
    expect(el.querySelectorAll("mat-form-field")).toHaveLength(2);
  });

  it("hides the register button outside planning", () => {
    const el: HTMLElement = setup(true, "in_progress").nativeElement;

    expect(el.textContent).not.toContain("Inscribir equipos");
  });
});
