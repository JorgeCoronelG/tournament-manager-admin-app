import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideRouter } from "@angular/router";
import { of, throwError } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
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

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
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
});
