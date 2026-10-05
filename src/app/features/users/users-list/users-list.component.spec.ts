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
import { User, UsersQuery } from "../user.model";
import { UsersApi } from "../users.api";
import { toSortParam, UsersListComponent } from "./users-list.component";

const user = (id: number, status: User["status"] = "active"): User => ({
  id,
  first_name: `Ana${id}`,
  last_name: "Pérez",
  email: `u${id}@example.com`,
  phone: null,
  user_code: `U${id}`,
  photo_url: null,
  is_active: status !== "inactive",
  email_verified_at: null,
  status,
  roles: [{ id: 2, code: "player", name: "Jugador" }],
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("UsersListComponent", () => {
  const setStatus = vi.fn();
  const remove = vi.fn();
  const resendInvitation = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();

  let rows: WritableSignal<User[] | undefined>;
  let loading: WritableSignal<boolean>;
  let failure: WritableSignal<unknown>;
  let query: () => UsersQuery;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: UsersApi,
          useValue: {
            setStatus,
            remove,
            resendInvitation,
            roles: () => ({
              value: signal([{ id: 2, code: "player", name: "Jugador" }]),
            }),
            list: (q: () => UsersQuery) => {
              query = q;

              return {
                resource: { isLoading: loading, error: failure, reload },
                rows,
                total: signal(rows()?.length ?? 0),
              };
            },
          },
        },
        { provide: MatDialog, useValue: { open } },
        {
          provide: SnackbarService,
          useValue: { notifySuccess, notifyFailure },
        },
      ],
    });

    const fixture = TestBed.createComponent(UsersListComponent);
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
    ]) {
      fn.mockReset();
    }
    setStatus.mockReturnValue(of({}));
    remove.mockReturnValue(of(undefined));
    resendInvitation.mockReturnValue(of({}));
    rows = signal<User[] | undefined>([user(1), user(2, "pending")]);
    loading = signal(false);
    failure = signal<unknown>(undefined);
  });

  it("shows a row per user", () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelectorAll("tr[mat-row]")).toHaveLength(
      2,
    );
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
      "No pudimos cargar los usuarios",
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

    fixture.componentInstance.filtersForm.status().value.set("pending");
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
    expect(query()).toMatchObject({ page: 3, pageSize: 10 });

    list.filtersForm.roleId().value.set(2);
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, pageSize: 10, roleId: 2 });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.filtersForm.status().value.set("pending");
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, status: "pending" });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "first_name", direction: "asc" });
    TestBed.tick();
    expect(query()).toMatchObject({ page: 0, sort: "first_name" });
  });

  it("builds the sort param", () => {
    expect(toSortParam({ active: "last_name", direction: "desc" })).toBe(
      "-last_name",
    );
    expect(toSortParam({ active: "last_name", direction: "asc" })).toBe(
      "last_name",
    );
    expect(toSortParam({ active: "last_name", direction: "" })).toBe("");
  });

  it("only offers to resend the invitation to pending users", () => {
    const fixture = setup();
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll("tr[mat-row]"),
    ).map((row) =>
      (row as HTMLElement).innerHTML.includes("Reenviar invitación"),
    );

    expect(labels).toEqual([false, true]);
  });

  it("toggles the active flag and reloads", () => {
    const { componentInstance: list } = setup();

    list.toggleActive(user(1));

    expect(setStatus).toHaveBeenCalledWith(1, false);
    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("users.deactivated");
  });

  it("resends the invitation", () => {
    const { componentInstance: list } = setup();

    list.resendInvitation(user(2, "pending"));

    expect(resendInvitation).toHaveBeenCalledWith(2);
    expect(notifySuccess).toHaveBeenCalledWith("users.invitationSent");
  });

  it("deletes only after the user confirms", () => {
    const { componentInstance: list } = setup();

    open.mockReturnValue({ afterClosed: () => of(undefined) });
    list.remove(user(1));
    expect(remove).not.toHaveBeenCalled();

    open.mockReturnValue({ afterClosed: () => of(true) });
    list.remove(user(1));
    expect(remove).toHaveBeenCalledWith(1);
    expect(reload).toHaveBeenCalled();
  });

  it("reports a failed action", () => {
    setStatus.mockReturnValue(throwError(() => new Error("boom")));
    const { componentInstance: list } = setup();

    list.toggleActive(user(1));

    expect(notifyFailure).toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("reloads after saving in the form dialog", () => {
    const { componentInstance: list } = setup();
    open.mockReturnValue({ afterClosed: () => of(user(3)) });

    list.openForm();

    expect(reload).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith("users.created");
  });
});
