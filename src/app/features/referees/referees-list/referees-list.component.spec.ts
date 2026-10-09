import { Clipboard } from "@angular/cdk/clipboard";
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
import { Referee, RefereesQuery } from "../referee.model";
import { RefereesApi } from "../referees.api";
import { RefereesListComponent } from "./referees-list.component";

const referee = (
  id: number,
  accountStatus: Referee["account_status"] = "active",
  status: Referee["status"] = "active",
): Referee => ({
  id,
  first_name: `Ana${id}`,
  last_name: "Pérez",
  email: `r${id}@example.com`,
  phone: null,
  user_code: `CLAVE${id}`,
  photo_url: null,
  account_status: accountStatus,
  status,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("RefereesListComponent", () => {
  const setStatus = vi.fn();
  const remove = vi.fn();
  const resendInvitation = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();
  const copy = vi.fn();

  let rows: WritableSignal<Referee[] | undefined>;
  let loading: WritableSignal<boolean>;
  let failure: WritableSignal<unknown>;
  let leagues: WritableSignal<MyLeague[]>;
  let activeLeague: WritableSignal<MyLeague | null>;
  let query: () => RefereesQuery;

  const league = (id: number) => ({ id, name: `Liga ${id}` }) as MyLeague;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: RefereesApi,
          useValue: {
            setStatus,
            remove,
            resendInvitation,
            list: (q: () => RefereesQuery) => {
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
        { provide: Clipboard, useValue: { copy } },
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

    const fixture = TestBed.createComponent(RefereesListComponent);
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    for (const fn of [
      setStatus,
      remove,
      resendInvitation,
      reload,
      notifySuccess,
      notifyFailure,
      open,
      confirm,
      copy,
    ]) {
      fn.mockReset();
    }
    setStatus.mockReturnValue(of({}));
    remove.mockReturnValue(of(undefined));
    resendInvitation.mockReturnValue(of({}));
    copy.mockReturnValue(true);
    rows = signal<Referee[] | undefined>([
      referee(1),
      referee(2, "pending"),
      referee(3, "active", "inactive"),
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

  it("shows a row per referee with their code, account and league status", () => {
    const fixture = setup();
    const text = Array.from(
      fixture.nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) => (row as HTMLElement).textContent);

    expect(text).toHaveLength(3);
    expect(text[0]).toContain("Ana1 Pérez");
    expect(text[0]).toContain("CLAVE1");
    expect(text[1]).toContain("Pendiente");
    expect(text[2]).toContain("Inactivo");
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
      "No pudimos cargar los árbitros",
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

    fixture.componentInstance.filtersForm.status().value.set("inactive");
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "Ningún resultado coincide con tu búsqueda.",
    );
  });

  it("only offers to edit and re-invite pending accounts", () => {
    const fixture = setup();
    const actions = Array.from(
      fixture.nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) =>
      Array.from(
        (row as HTMLElement).querySelectorAll("td:last-child button"),
      ).map((button) => button.getAttribute("aria-label")),
    );

    expect(actions).toEqual([
      ["Dar de baja en la liga", "Quitar de la liga"],
      [
        "Editar",
        "Reenviar invitación",
        "Dar de baja en la liga",
        "Quitar de la liga",
      ],
      ["Dar de alta en la liga", "Quitar de la liga"],
    ]);
  });

  it("goes back to the first page when the search, filter, order or league change", () => {
    const { componentInstance: list } = setup();

    expect(query()).toMatchObject({
      page: 0,
      pageSize: 5,
      sort: "-created_at",
    });

    list.changePage({ pageIndex: 3, pageSize: 10 });
    list.filtersForm.status().value.set("active");
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10, status: "active" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "first_name", direction: "asc" });
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, sort: "first_name" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    activeLeague.set(league(4));
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10 });
  });

  it("copies the code and says so", () => {
    const { componentInstance: list } = setup();

    list.copyCode(referee(1));

    expect(copy).toHaveBeenCalledWith("CLAVE1");
    expect(notifySuccess).toHaveBeenCalledWith("referees.codeCopied");
  });

  it("deactivates an active referee and activates an inactive one", () => {
    const { componentInstance: list } = setup();

    list.toggleStatus(referee(1));
    expect(setStatus).toHaveBeenLastCalledWith(1, "inactive");
    expect(notifySuccess).toHaveBeenLastCalledWith("referees.deactivated");

    list.toggleStatus(referee(3, "active", "inactive"));
    expect(setStatus).toHaveBeenLastCalledWith(3, "active");
    expect(notifySuccess).toHaveBeenLastCalledWith("referees.activated");
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("removes from the league only after the user confirms", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.remove(referee(1));
    expect(remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.remove(referee(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "referees.remove",
      params: { name: "Ana1 Pérez" },
    });
    expect(remove).toHaveBeenCalledWith(1);
    expect(notifySuccess).toHaveBeenCalledWith("referees.removed");
  });

  it("resends the invitation", () => {
    const { componentInstance: list } = setup();

    list.resendInvitation(referee(2, "pending"));

    expect(resendInvitation).toHaveBeenCalledWith(2);
    expect(notifySuccess).toHaveBeenCalledWith("referees.invitationSent");
  });

  it("reports a failed action", () => {
    setStatus.mockReturnValue(throwError(() => new Error("boom")));
    const { componentInstance: list } = setup();

    list.toggleStatus(referee(1));

    expect(notifyFailure).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("reloads after adding or editing", () => {
    const { componentInstance: list } = setup();

    open.mockReturnValue({ afterClosed: () => of("attached") });
    list.openAdd();
    expect(notifySuccess).toHaveBeenLastCalledWith("referees.attached");

    open.mockReturnValue({ afterClosed: () => of("created") });
    list.openAdd();
    expect(notifySuccess).toHaveBeenLastCalledWith("referees.created");

    open.mockReturnValue({ afterClosed: () => of(referee(2)) });
    list.openEdit(referee(2, "pending"));
    expect(notifySuccess).toHaveBeenLastCalledWith("referees.updated");
    expect(reload).toHaveBeenCalledTimes(3);
  });
});
