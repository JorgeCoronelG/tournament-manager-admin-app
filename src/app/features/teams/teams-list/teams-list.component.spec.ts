import { BreakpointObserver } from "@angular/cdk/layout";
import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
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
import { Team, TeamManager } from "../team.model";
import { TeamsApi } from "../teams.api";
import { TeamsListComponent } from "./teams-list.component";

const manager = (
  accountStatus: TeamManager["account_status"],
): TeamManager => ({
  id: 7,
  first_name: "Luis",
  last_name: "Pérez",
  email: "luis@example.com",
  phone: null,
  user_code: "DEL0007",
  photo_url: null,
  account_status: accountStatus,
});

const team = (
  id: number,
  {
    status = "active",
    delegate = null,
  }: {
    status?: Team["status"];
    delegate?: TeamManager | null;
  } = {},
): Team => ({
  id,
  name: `Equipo ${id}`,
  logo_url: null,
  status,
  manager: delegate,
  created_at: "2026-01-01T00:00:00.000Z",
});

describe("TeamsListComponent", () => {
  const setStatus = vi.fn();
  const remove = vi.fn();
  const removeManager = vi.fn();
  const resendInvitation = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();

  let rows: WritableSignal<Team[] | undefined>;
  let activeLeague: WritableSignal<MyLeague | null>;

  const league = (id: number) => ({ id, name: `Liga ${id}` }) as MyLeague;

  function setup(mobile = false) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (query: string) =>
              of({ matches: mobile && query.includes("599"), breakpoints: {} }),
            isMatched: (query: string) => mobile && query.includes("599"),
          },
        },
        provideRouter([]),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: TeamsApi,
          useValue: {
            setStatus,
            remove,
            removeManager,
            resendInvitation,
            managers: () => ({
              hasValue: () => true,
              value: () => [{ id: 7, first_name: "Luis", last_name: "Pérez" }],
              reload: vi.fn(),
            }),
            list: () => ({
              resource: {
                isLoading: signal(false),
                error: signal(undefined),
                reload,
              },
              rows,
              total: signal(rows()?.length ?? 0),
            }),
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

    const fixture = TestBed.createComponent(TeamsListComponent);
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    for (const fn of [
      setStatus,
      remove,
      removeManager,
      resendInvitation,
      reload,
      notifySuccess,
      notifyFailure,
      open,
      confirm,
    ]) {
      fn.mockReset();
    }
    rows = signal<Team[] | undefined>([team(1), team(2)]);
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

  it("shows a row per team on desktop, with the actions column last", () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelectorAll("tr[mat-row]")).toHaveLength(
      2,
    );
    expect(fixture.componentInstance.columns().at(-1)).toBe("actions");
    expect(
      fixture.nativeElement.querySelector("app-filters-toggle"),
    ).toBeNull();
  });

  describe("on phones", () => {
    const button = (root: ParentNode, label: string) =>
      root.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);
    const labels = () =>
      Array.from(
        document.querySelectorAll(".mat-mdc-menu-panel [mat-menu-item]"),
      ).map((item) => item.textContent?.trim());

    async function openMenu(fixture: ReturnType<typeof setup>) {
      button(fixture.nativeElement, "Acciones")?.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }

    it("shows the search, the filters button and the full add button; status and delegate wait for the panel", () => {
      const fixture = setup(true);
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector("input[type=search]")).toBeTruthy();
      expect(button(el, "Filtros")).toBeTruthy();
      const add = Array.from(el.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Agregar equipo"),
      );
      expect(add?.classList).toContain("w-full");
      expect(el.querySelector("mat-select")).toBeNull();

      button(el, "Filtros")?.click();
      fixture.detectChanges();
      expect(el.querySelectorAll("mat-select")).toHaveLength(2);
    });

    it("counts both filters and clears both", () => {
      const fixture = setup(true);
      const el: HTMLElement = fixture.nativeElement;
      const list = fixture.componentInstance;

      button(el, "Filtros")?.click();
      fixture.detectChanges();
      const clear = Array.from(el.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Limpiar",
      ) as HTMLButtonElement;
      expect(clear.disabled).toBe(true);

      list.filters.update((f) => ({ ...f, status: "banned", manager: 7 }));
      fixture.detectChanges();
      expect(list.activeFilters()).toBe(2);
      expect(button(el, "Filtros")?.getAttribute("aria-label")).toBe(
        "Filtros, 2 activos",
      );

      clear.click();
      fixture.detectChanges();
      expect(list.filters()).toMatchObject({ status: "", manager: "" });
      expect(list.activeFilters()).toBe(0);
    });

    it("drops the delegate filter when that delegate is gone, and resets everything on a league change", () => {
      const fixture = setup(true);
      const list = fixture.componentInstance;

      list.filters.update((f) => ({ ...f, manager: 99 }));
      fixture.detectChanges();
      expect(list.filters().manager).toBe("");

      list.filters.update((f) => ({ ...f, status: "banned", manager: 7 }));
      fixture.detectChanges();
      activeLeague.set(league(4));
      fixture.detectChanges();
      expect(list.filters()).toEqual({ search: "", status: "", manager: "" });
    });

    it("puts the actions menu first, without the delegate column", () => {
      const columns = setup(true).componentInstance.columns();

      expect(columns).toEqual([
        "actionsMenu",
        "logo",
        "name",
        "status",
        "created_at",
      ]);
    });

    it("offers a team with no delegate to assign one", async () => {
      rows.set([team(1)]);
      await openMenu(setup(true));

      expect(labels()).toEqual([
        "Editar",
        "Asignar delegado",
        "Vetar",
        "Eliminar",
      ]);
    });

    it("offers a team with an active delegate to change or remove them", async () => {
      rows.set([team(1, { delegate: manager("active") })]);
      await openMenu(setup(true));

      expect(labels()).toEqual([
        "Editar",
        "Cambiar delegado",
        "Quitar delegado",
        "Vetar",
        "Eliminar",
      ]);
    });

    it("offers all seven actions when the delegate's account is pending", async () => {
      rows.set([team(1, { delegate: manager("pending") })]);
      await openMenu(setup(true));

      expect(labels()).toEqual([
        "Editar",
        "Cambiar delegado",
        "Editar datos del delegado",
        "Reenviar invitación",
        "Quitar delegado",
        "Vetar",
        "Eliminar",
      ]);
    });

    it("offers to lift the ban of a banned team", async () => {
      rows.set([team(1, { status: "banned" })]);
      await openMenu(setup(true));

      expect(labels()).toEqual([
        "Editar",
        "Asignar delegado",
        "Levantar veto",
        "Eliminar",
      ]);
    });

    it("draws the divider once, between the delegate group and ban/delete", async () => {
      rows.set([team(1, { delegate: manager("pending") })]);
      await openMenu(setup(true));

      const panel = document.querySelector(
        ".mat-mdc-menu-panel",
      ) as HTMLElement;
      const children = Array.from(
        panel.querySelectorAll("mat-divider, [mat-menu-item]"),
      );
      const divider = children.findIndex((el) => el.tagName === "MAT-DIVIDER");

      expect(panel.querySelectorAll("mat-divider")).toHaveLength(1);
      expect(children[divider + 1].textContent?.trim()).toBe("Vetar");
      expect(children[divider - 1].textContent?.trim()).toBe("Quitar delegado");
    });
  });
});
