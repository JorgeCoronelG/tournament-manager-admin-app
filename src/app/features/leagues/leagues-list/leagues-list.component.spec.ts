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
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { League, LeaguesQuery } from "../league.model";
import { UsersApi } from "../../users/users.api";
import { LeaguesApi } from "../leagues.api";
import { LeaguesListComponent } from "./leagues-list.component";

const league = (id: number): League => ({
  id,
  name: `Liga ${id}`,
  admin: {
    id: 7,
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@example.com",
    status: "pending",
  },
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("LeaguesListComponent", () => {
  const remove = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();

  let rows: WritableSignal<League[] | undefined>;
  let loading: WritableSignal<boolean>;
  let failure: WritableSignal<unknown>;
  let query: () => LeaguesQuery;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: LeaguesApi,
          useValue: {
            remove,
            // The manager filter searches on its own; it is not under test here
            adminCandidates: () => ({
              value: signal(undefined),
              hasValue: () => false,
              isLoading: () => false,
              error: signal(undefined),
              reload: vi.fn(),
            }),
            list: (q: () => LeaguesQuery) => {
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
          provide: UsersApi,
          useValue: {
            roles: () => ({
              value: signal([]),
              error: signal(undefined),
              hasValue: () => false,
              reload: vi.fn(),
            }),
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
    const fixture = TestBed.createComponent(LeaguesListComponent);
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    for (const fn of [
      remove,
      reload,
      notifySuccess,
      notifyFailure,
      open,
      confirm,
    ]) {
      fn.mockReset();
    }
    remove.mockReturnValue(of(undefined));
    rows = signal<League[] | undefined>([league(1), league(2)]);
    loading = signal(false);
    failure = signal<unknown>(undefined);
  });

  it("shows a row per league with its manager and status", () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelectorAll("tr[mat-row]")).toHaveLength(
      2,
    );
    expect(fixture.nativeElement.textContent).toContain("Liga 1");
    expect(fixture.nativeElement.textContent).toContain("ana@example.com");
    expect(fixture.nativeElement.textContent).toContain("Pendiente");
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
      "No pudimos cargar las ligas",
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

    fixture.componentInstance.filtersForm.adminUserId().value.set(7);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "Ningún resultado coincide con tu búsqueda.",
    );
  });

  it("starts on the first page sorted by newest and goes back to it when filters or order change", () => {
    const { componentInstance: list } = setup();

    expect(query()).toMatchObject({
      page: 0,
      pageSize: 5,
      sort: "-created_at",
    });

    list.changePage({ pageIndex: 3, pageSize: 10 });
    list.filtersForm.adminUserId().value.set(7);
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10, adminUserId: 7 });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.filtersForm.search().value.set("norte");
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, search: "norte" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "name", direction: "asc" });
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, sort: "name" });
  });

  it("deletes only after the user confirms", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.remove(league(1));
    expect(remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.remove(league(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "leagues.delete",
      params: { name: "Liga 1" },
    });
    expect(remove).toHaveBeenCalledWith(1);
    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("leagues.deleted");
  });

  it("reports a failed delete", () => {
    remove.mockReturnValue(throwError(() => new Error("boom")));
    confirm.mockReturnValue(of(true));
    const { componentInstance: list } = setup();

    list.remove(league(1));

    expect(notifyFailure).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("reloads after saving in the form dialog", () => {
    const { componentInstance: list } = setup();
    open.mockReturnValue({ afterClosed: () => of(league(3)) });

    list.openForm();
    expect(notifySuccess).toHaveBeenCalledWith("leagues.created");

    list.openForm(league(1));
    expect(notifySuccess).toHaveBeenCalledWith("leagues.updated");
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
