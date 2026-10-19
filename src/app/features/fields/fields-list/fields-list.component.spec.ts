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
import { Field, FieldsQuery } from "../field.model";
import { FieldsApi } from "../fields.api";
import { FieldsListComponent } from "./fields-list.component";

const field = (id: number, status: Field["status"] = "active"): Field => ({
  id,
  league_id: 3,
  name: `Cancha ${id}`,
  status,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("FieldsListComponent", () => {
  const setStatus = vi.fn();
  const remove = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();

  let rows: WritableSignal<Field[] | undefined>;
  let failure: WritableSignal<unknown>;
  let activeLeague: WritableSignal<MyLeague | null>;
  let query: () => FieldsQuery;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: FieldsApi,
          useValue: {
            setStatus,
            remove,
            list: (q: () => FieldsQuery) => {
              query = q;

              return {
                resource: {
                  isLoading: signal(false),
                  error: failure,
                  reload,
                },
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
            leagues: signal([league(3), league(4)]),
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

    const fixture = TestBed.createComponent(FieldsListComponent);
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
    rows = signal<Field[] | undefined>([field(1), field(2, "inactive")]);
    failure = signal<unknown>(undefined);
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

  it("shows a row per field with its status chip", () => {
    const text = Array.from(
      setup().nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) => (row as HTMLElement).textContent);

    expect(text).toHaveLength(2);
    expect(text[0]).toContain("Cancha 1");
    expect(text[0]).toContain("Activa");
    expect(text[1]).toContain("Inactiva");
  });

  it("labels the toggle by what it will do", () => {
    const labels = Array.from(
      setup().nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) =>
      Array.from((row as HTMLElement).querySelectorAll("button")).map(
        (button) => button.getAttribute("aria-label"),
      ),
    );

    expect(labels).toEqual([
      ["Editar", "Desactivar", "Eliminar"],
      ["Editar", "Activar", "Eliminar"],
    ]);
  });

  it("shows the error state and retries", () => {
    failure.set(new Error("boom"));
    const fixture = setup();

    expect(fixture.nativeElement.textContent).toContain(
      "No pudimos cargar las canchas",
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

    fixture.componentInstance.filtersForm.status().value.set("active");
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      "Ningún resultado coincide con tu búsqueda.",
    );
  });

  it("goes back to the first page when the filters, order or league change", () => {
    const { componentInstance: list } = setup();

    list.changePage({ pageIndex: 3, pageSize: 10 });
    list.filtersForm.status().value.set("inactive");
    TestBed.tick();
    expect(query()).toMatchObject({
      page: 0,
      pageSize: 10,
      status: "inactive",
    });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "name", direction: "asc" });
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, sort: "name" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    activeLeague.set(league(4));
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10 });
  });

  it("asks before deactivating", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.toggleStatus(field(1));
    expect(setStatus).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.toggleStatus(field(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "fields.deactivate",
      params: { name: "Cancha 1" },
    });
    expect(setStatus).toHaveBeenCalledWith(1, "inactive");
    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("fields.deactivated");
  });

  it("activates without asking", () => {
    const { componentInstance: list } = setup();

    list.toggleStatus(field(2, "inactive"));

    expect(confirm).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(2, "active");
    expect(notifySuccess).toHaveBeenCalledWith("fields.activated");
  });

  it("deletes only after the user confirms", () => {
    const { componentInstance: list } = setup();

    confirm.mockReturnValue(of(false));
    list.remove(field(1));
    expect(remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(of(true));
    list.remove(field(1));
    expect(confirm).toHaveBeenCalledWith({
      key: "fields.delete",
      params: { name: "Cancha 1" },
    });
    expect(remove).toHaveBeenCalledWith(1);
    expect(notifySuccess).toHaveBeenCalledWith("fields.deleted");
  });

  it("reports a failed action without reloading", () => {
    remove.mockReturnValue(throwError(() => new Error("boom")));
    confirm.mockReturnValue(of(true));
    const { componentInstance: list } = setup();

    list.remove(field(1));

    expect(notifyFailure).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads and notifies after the form dialog saves", () => {
    const { componentInstance: list } = setup();
    open.mockReturnValue({ afterClosed: () => of(field(5)) });

    list.openForm();
    expect(notifySuccess).toHaveBeenLastCalledWith("fields.created");

    list.openForm(field(1));
    expect(notifySuccess).toHaveBeenLastCalledWith("fields.updated");
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does nothing when the form dialog is dismissed", () => {
    const { componentInstance: list } = setup();
    open.mockReturnValue({ afterClosed: () => of(undefined) });

    list.openForm();

    expect(reload).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
