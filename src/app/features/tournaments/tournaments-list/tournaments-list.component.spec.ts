import { signal, WritableSignal } from "@angular/core";
import { BreakpointObserver } from "@angular/cdk/layout";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueLimitsApi } from "../../leagues/league-limits.api";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { MyLeague } from "../../../core/league-context/my-league.model";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { CurrentUserService } from "../../../core/user/current-user.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { Tournament, TournamentsQuery } from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";
import { TournamentsListComponent } from "./tournaments-list.component";

const tournament = (
  id: number,
  status: Tournament["status"] = "planning",
  ages: Pick<Tournament, "min_age" | "max_age"> = {
    min_age: 18,
    max_age: 35,
  },
): Tournament => ({
  id,
  league_id: 3,
  name: `Torneo ${id}`,
  gender: "female",
  ...ages,
  start_date: "2026-03-01",
  max_roster_size: null,
  min_matches_for_playoffs: null,
  rounds: 1,
  match_duration_minutes: 60,
  walkover_goals: 3,
  tiebreakers: ["points", "goal_difference", "goals_for", "head_to_head"],
  playoffs_started: false,
  status,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("TournamentsListComponent", () => {
  const setStatus = vi.fn();
  const remove = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();

  let rows: WritableSignal<Tournament[] | undefined>;
  let loading: WritableSignal<boolean>;
  let failure: WritableSignal<unknown>;
  let leagues: WritableSignal<MyLeague[]>;
  let activeLeague: WritableSignal<MyLeague | null>;
  let query: () => TournamentsQuery;
  let limitsValue: unknown;

  function setup(mobile = false) {
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
        {
          provide: LeagueLimitsApi,
          useValue: {
            ofActiveLeague: () => ({
              hasValue: () => limitsValue !== undefined,
              value: () => limitsValue,
              error: () => undefined,
              reload: vi.fn(),
            }),
          },
        },
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: TournamentsApi,
          useValue: {
            setStatus,
            remove,
            list: (q: () => TournamentsQuery) => {
              query = q;

              return {
                resource: { isLoading: loading, error: failure, reload },
                rows,
                total: signal(rows()?.length ?? 0),
              };
            },
          },
        },
        {
          provide: LeagueContextService,
          useValue: {
            activeLeague,
            activeLeagueId: () => activeLeague()?.id ?? null,
            leagues,
            isLoading: signal(false),
            error: signal(undefined),
            reload: vi.fn(),
          },
        },
        { provide: MatDialog, useValue: { open } },
        { provide: ConfirmDialogService, useValue: { confirm } },
        {
          provide: SnackbarService,
          useValue: { notifySuccess, notifyFailure },
        },
      ],
    });
    TestBed.inject(CurrentUserService).setUser({
      id: 1,
      name: "Ada",
      role: "",
      roles: ["league_admin"],
      avatarUrl: null,
    });

    const fixture = TestBed.createComponent(TournamentsListComponent);
    fixture.detectChanges();

    return fixture;
  }

  const league = (id: number) => ({ id, name: `Liga ${id}` }) as MyLeague;

  beforeEach(() => {
    for (const fn of [
      setStatus,
      remove,
      reload,
      notifySuccess,
      notifyFailure,
      open,
      confirm,
    ]) {
      fn.mockReset();
    }
    limitsValue = undefined;
    setStatus.mockReturnValue(of({}));
    remove.mockReturnValue(of(undefined));
    rows = signal<Tournament[] | undefined>([
      tournament(1),
      tournament(2, "in_progress", { min_age: 25, max_age: null }),
      tournament(3, "finished", { min_age: null, max_age: 40 }),
      tournament(4, "planning", { min_age: null, max_age: null }),
    ]);
    loading = signal(false);
    failure = signal<unknown>(undefined);
    leagues = signal([league(3), league(4)]);
    activeLeague = signal<MyLeague | null>(league(3));
  });

  it("asks to pick a league and shows no table without one", () => {
    activeLeague.set(null);
    const fixture = setup();

    expect(fixture.nativeElement.textContent).toContain(
      "Selecciona una liga para continuar.",
    );
    expect(fixture.nativeElement.querySelector("table")).toBeNull();
  });

  it("shows a row per tournament with its age range, date and status", () => {
    const fixture = setup();
    const text = Array.from(
      fixture.nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) => (row as HTMLElement).textContent);

    expect(text).toHaveLength(4);
    expect(text[0]).toContain("18 – 35");
    expect(text[0]).toContain("01/03/2026");
    expect(text[0]).toContain("Femenil");
    expect(text[0]).toContain("Planeación");
    expect(text[1]).toContain("Desde 25");
    expect(text[1]).toContain("En curso");
    expect(text[2]).toContain("Hasta 40");
    expect(text[2]).toContain("Finalizado");
    expect(text[3]).toContain("Sin límite");
  });

  it("shows the loading bar", () => {
    loading.set(true);
    const fixture = setup();

    expect(
      fixture.nativeElement
        .querySelector("mat-progress-bar")
        .classList.contains("invisible"),
    ).toBe(false);
  });

  it("shows the error state and retries", () => {
    failure.set(new Error("boom"));
    const fixture = setup();

    expect(fixture.nativeElement.textContent).toContain(
      "No pudimos cargar los torneos",
    );
    fixture.nativeElement.querySelector("[role=alert] button").click();
    expect(reload).toHaveBeenCalled();
  });

  it("tells an empty table from one emptied by the filters", () => {
    rows.set([]);
    const fixture = setup();

    expect(fixture.nativeElement.textContent).toContain(
      "Aún no hay registros.",
    );

    fixture.componentInstance.filtersForm.gender().value.set("male");
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "Ningún resultado coincide con tu búsqueda.",
    );
  });

  it("offers the actions that fit each status", () => {
    const fixture = setup();
    const actions = Array.from(
      fixture.nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) =>
      Array.from((row as HTMLElement).querySelectorAll("button")).map(
        (button) => button.getAttribute("aria-label"),
      ),
    );

    expect(actions).toEqual([
      ["Editar", "Iniciar torneo", "Eliminar"],
      ["Editar", "Finalizar torneo"],
      [],
      ["Editar", "Iniciar torneo", "Eliminar"],
    ]);
  });

  it("goes back to the first page when the filters, order or league change", () => {
    const { componentInstance: list } = setup();

    expect(query()).toMatchObject({
      page: 0,
      pageSize: 5,
      sort: "-created_at",
    });

    list.changePage({ pageIndex: 3, pageSize: 10 });
    list.filtersForm.gender().value.set("male");
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10, gender: "male" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.filtersForm.status().value.set("finished");
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, status: "finished" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "start_date", direction: "asc" });
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, sort: "start_date" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    activeLeague.set(league(4));
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10 });
  });

  it("starts a planned tournament only after the user confirms", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.advance(tournament(1));
    expect(setStatus).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.advance(tournament(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "tournaments.start",
      params: { name: "Torneo 1" },
      tone: "primary",
    });
    expect(setStatus).toHaveBeenCalledWith(1, "in_progress");
    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("tournaments.started");
  });

  it("finishes a tournament in progress after the user confirms", () => {
    const { componentInstance: list } = setup();
    confirm.mockReturnValue(of(true));

    list.advance(tournament(2, "in_progress"));

    expect(confirm).toHaveBeenCalledWith({
      key: "tournaments.finish",
      params: { name: "Torneo 2" },
      tone: "danger",
    });
    expect(setStatus).toHaveBeenCalledWith(2, "finished");
    expect(notifySuccess).toHaveBeenCalledWith("tournaments.finished");
  });

  it("deletes only after the user confirms", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.remove(tournament(1));
    expect(remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.remove(tournament(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "tournaments.delete",
      params: { name: "Torneo 1" },
    });
    expect(remove).toHaveBeenCalledWith(1);
    expect(notifySuccess).toHaveBeenCalledWith("tournaments.deleted");
  });

  it("reports a failed action", () => {
    setStatus.mockReturnValue(throwError(() => new Error("boom")));
    confirm.mockReturnValue(of(true));
    const { componentInstance: list } = setup();

    list.advance(tournament(1));

    expect(notifyFailure).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("reloads after saving in the form dialog", () => {
    const { componentInstance: list } = setup();
    open.mockReturnValue({ afterClosed: () => of(tournament(5)) });

    list.openForm();

    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("tournaments.created");
  });

  it("shows the usage when the league has a limit and says so when it has none", () => {
    limitsValue = {
      max_active_tournaments: 3,
      usage: { active_tournaments: 2, tournaments: [] },
    };
    expect(setup().nativeElement.textContent).toContain(
      "Torneos activos 2 de 3",
    );

    TestBed.resetTestingModule();
    limitsValue = {
      max_active_tournaments: null,
      usage: { active_tournaments: 2, tournaments: [] },
    };
    const text = setup().nativeElement.textContent;
    expect(text).toContain("Sin límite de torneos activos");
    expect(text).not.toContain("∞");
  });

  describe("on phones", () => {
    const labels = (root: ParentNode) =>
      Array.from(root.querySelectorAll("[mat-menu-item]")).map((item) =>
        item.textContent?.replace(/\s+/g, " ").trim(),
      );

    async function openMenu(
      fixture: ReturnType<typeof setup>,
      row: number,
    ): Promise<HTMLElement> {
      const rowEl = fixture.nativeElement.querySelectorAll("tr[mat-row]")[row];
      (
        rowEl.querySelector("app-row-actions button") as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      await fixture.whenStable();

      return document.querySelector(".mat-mdc-menu-panel") as HTMLElement;
    }

    afterEach(() =>
      document.querySelector(".cdk-overlay-container")?.replaceChildren(),
    );

    it("shows the search, the filters button and a full-width add button", () => {
      const fixture = setup(true);
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector("input[type=search]")).not.toBeNull();
      expect(el.querySelector("app-filters-toggle")).not.toBeNull();
      expect(el.querySelector("mat-select")).toBeNull();
      const add = Array.from(el.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Nuevo torneo"),
      );
      expect(add?.classList.contains("w-full")).toBe(true);
    });

    it("keeps gender and status in the panel, counts both and clears both", () => {
      const fixture = setup(true);
      const list = fixture.componentInstance;
      const el: HTMLElement = fixture.nativeElement;

      list.filtersForm.gender().value.set("male");
      list.filtersForm.status().value.set("finished");
      list.filtersForm.search().value.set("abc");
      fixture.detectChanges();

      expect(list.activeFilters()).toBe(2);

      list.filtersOpen.set(true);
      fixture.detectChanges();
      expect(el.querySelectorAll("app-filters-panel mat-select")).toHaveLength(
        2,
      );

      list.clearFilters();
      fixture.detectChanges();
      expect(list.filters()).toMatchObject({
        gender: "",
        status: "",
        search: "abc",
      });
      expect(list.activeFilters()).toBe(0);
    });

    it("starts with the panel open only when a filter is already set", () => {
      expect(setup(true).componentInstance.filtersOpen()).toBe(false);
    });

    it("uses the menu column first, without the desktop actions or sticky header", () => {
      const fixture = setup(true);

      expect(fixture.componentInstance.columns()[0]).toBe("actionsMenu");
      expect(fixture.componentInstance.columns()).not.toContain("actions");
      expect(
        fixture.nativeElement.querySelector(
          "tr[mat-header-row].mat-mdc-table-sticky",
        ),
      ).toBeNull();
    });

    it("lists the menu actions of a planned tournament, delete apart", async () => {
      const fixture = setup(true);
      const panel = await openMenu(fixture, 0);

      expect(labels(panel)).toEqual(["Editar", "Iniciar torneo", "Eliminar"]);
      expect(panel.querySelectorAll("mat-divider")).toHaveLength(1);
    });

    it("offers edit and finish for a tournament in progress", async () => {
      const fixture = setup(true);
      const panel = await openMenu(fixture, 1);

      expect(labels(panel)).toEqual(["Editar", "Finalizar torneo"]);
      expect(panel.querySelectorAll("mat-divider")).toHaveLength(0);
    });

    it("offers edit and finish for a tournament in the playoffs", () => {
      const list = setup(true).componentInstance;

      expect(
        list.rowActions(tournament(7, "playoffs")).map((a) => a.labelKey),
      ).toEqual(["tournaments.actions.edit", "tournaments.actions.finish"]);
    });

    it("has no menu for a finished tournament", () => {
      const fixture = setup(true);
      const rowsEl = fixture.nativeElement.querySelectorAll("tr[mat-row]");

      expect(rowsEl[2].querySelector("app-row-actions")).toBeNull();
      expect(rowsEl[0].querySelector("app-row-actions")).not.toBeNull();
    });

    it("disables start at the limit and says why inside the menu", async () => {
      limitsValue = {
        max_active_tournaments: 1,
        usage: { active_tournaments: 1, tournaments: [] },
      };
      const fixture = setup(true);
      const panel = await openMenu(fixture, 0);
      const start =
        panel.querySelectorAll<HTMLButtonElement>("[mat-menu-item]")[1];

      expect(start.disabled).toBe(true);
      expect(start.getAttribute("aria-disabled")).toBe("true");
      expect(start.textContent).toContain("Iniciar torneo");
      expect(start.textContent).toContain(
        fixture.componentInstance.advanceTip(tournament(1)).trim(),
      );
      expect(start.textContent).not.toBe("Iniciar torneo");
    });

    it("pages by 10 and hides the page size and first/last buttons", () => {
      const fixture = setup(true);

      expect(query()).toMatchObject({ pageSize: 10 });
      expect(
        fixture.nativeElement.querySelector(".mat-mdc-paginator-page-size"),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          ".mat-mdc-paginator-navigation-first",
        ),
      ).toBeNull();
    });

    it("clears the filters of the old league together with 'Clear' when the league changes", () => {
      const fixture = setup(true);
      const list = fixture.componentInstance;

      list.filtersForm.gender().value.set("male");
      TestBed.tick();
      list.clearFilters();
      list.filtersForm.status().value.set("planning");
      activeLeague.set(league(4));
      TestBed.tick();

      expect(list.filters()).toEqual({ search: "", gender: "", status: "" });
    });
  });

  it("does not move the desktop table: icon buttons and sticky header", () => {
    const fixture = setup();

    expect(fixture.componentInstance.columns().at(-1)).toBe("actions");
    expect(
      fixture.nativeElement.querySelector("app-filters-toggle"),
    ).toBeNull();
    // Gender and status, plus the paginator's page size
    expect(fixture.nativeElement.querySelectorAll("mat-select")).toHaveLength(
      3,
    );
  });
});
