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
import { Player } from "../player.model";
import { PlayersApi } from "../players.api";
import { PlayersListComponent } from "./players-list.component";

const player = (id: number, isBanned = false): Player => ({
  id,
  first_name: `Ana${id}`,
  last_name: "Pérez",
  photo_url: null,
  user_code: `JUG${id}`,
  gender: "female",
  birth_date: "2000-05-15",
  age: 26,
  phone: null,
  is_banned: isBanned,
  active_teams: [],
});

describe("PlayersListComponent", () => {
  const unban = vi.fn();
  const reload = vi.fn();
  const notifySuccess = vi.fn();
  const notifyFailure = vi.fn();
  const open = vi.fn();
  const confirm = vi.fn();

  let rows: WritableSignal<Player[] | undefined>;
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
          provide: PlayersApi,
          useValue: {
            unban,
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

    const fixture = TestBed.createComponent(PlayersListComponent);
    fixture.detectChanges();

    return fixture;
  }

  beforeEach(() => {
    for (const fn of [
      unban,
      reload,
      notifySuccess,
      notifyFailure,
      open,
      confirm,
    ]) {
      fn.mockReset();
    }
    unban.mockReturnValue(of({}));
    rows = signal<Player[] | undefined>([player(1), player(2, true)]);
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

  it("shows a row per player on desktop, with the actions column last", () => {
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

    it("shows the search and the filters button, and no add button; gender and status wait for the panel", () => {
      const fixture = setup(true);
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector("input[type=search]")).toBeTruthy();
      expect(button(el, "Filtros")).toBeTruthy();
      expect(
        Array.from(el.querySelectorAll("button")).some((b) =>
          /agregar|nuevo/i.test(b.textContent ?? ""),
        ),
      ).toBe(false);
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

      list.filters.update((f) => ({
        ...f,
        gender: "female",
        status: "banned",
      }));
      fixture.detectChanges();
      expect(list.activeFilters()).toBe(2);
      expect(button(el, "Filtros")?.getAttribute("aria-label")).toBe(
        "Filtros, 2 activos",
      );

      clear.click();
      fixture.detectChanges();
      expect(list.filters()).toMatchObject({ gender: "", status: "" });
      expect(list.activeFilters()).toBe(0);
    });

    it("resets the filters when the league changes", () => {
      const fixture = setup(true);
      const list = fixture.componentInstance;

      list.filters.update((f) => ({ ...f, gender: "male", status: "banned" }));
      fixture.detectChanges();
      activeLeague.set(league(4));
      fixture.detectChanges();

      expect(list.filters()).toEqual({ search: "", gender: "", status: "" });
    });

    it("puts the actions menu first", () => {
      const columns = setup(true).componentInstance.columns();

      expect(columns).toEqual([
        "actionsMenu",
        "photo",
        "name",
        "gender",
        "age",
        "phone",
        "status",
      ]);
    });

    it.each([
      [false, ["Ver detalle", "Corregir rama", "Vetar"]],
      [true, ["Ver detalle", "Corregir rama", "Reactivar"]],
    ])(
      "offers the right actions when is_banned is %s",
      async (banned, items) => {
        rows.set([player(1, banned)]);
        const fixture = setup(true);

        button(fixture.nativeElement, "Acciones")?.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(labels()).toEqual(items);
      },
    );
  });
});
