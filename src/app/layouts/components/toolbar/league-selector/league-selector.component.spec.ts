import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideRouter } from "@angular/router";
import { provideTestI18n } from "../../../../../testing/i18n";
import { LeagueContextService } from "../../../../core/league-context/league-context.service";
import { MyLeague } from "../../../../core/league-context/my-league.model";
import { Role } from "../../../../core/auth/role.model";
import { CurrentUserService } from "../../../../core/user/current-user.service";
import { LeagueSelectorComponent } from "./league-selector.component";

const leagues = (count: number): MyLeague[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Liga ${i + 1}`,
  }));

const MENU_BUTTON = "button[mat-stroked-button]";

describe("LeagueSelectorComponent", () => {
  const select = vi.fn();
  const reload = vi.fn();
  const clear = vi.fn();

  let list: WritableSignal<MyLeague[]>;
  let active: WritableSignal<MyLeague | null>;
  let loading: WritableSignal<boolean>;
  let failure: WritableSignal<unknown>;

  function setup(...roles: Role[]) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: LeagueContextService,
          useValue: {
            leagues: list,
            activeLeague: active,
            isLoading: loading,
            error: failure,
            select,
            reload,
            clear,
          },
        },
      ],
    });
    TestBed.inject(CurrentUserService).setUser({
      id: 1,
      name: "Ada",
      role: "",
      roles,
      avatarUrl: null,
    });

    const fixture = TestBed.createComponent(LeagueSelectorComponent);
    fixture.detectChanges();

    return fixture;
  }

  const text = (fixture: ReturnType<typeof setup>): string =>
    fixture.nativeElement.textContent.replace(/\s+/g, " ").trim();

  beforeEach(() => {
    select.mockReset();
    reload.mockReset();
    clear.mockReset();
    list = signal(leagues(3));
    active = signal<MyLeague | null>(list()[1]);
    loading = signal(false);
    failure = signal<unknown>(undefined);
  });

  it("renders nothing without the capability", () => {
    const fixture = setup("referee");

    expect(text(fixture)).toBe("");
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });

  it("shows the active league on a menu button", () => {
    const fixture = setup("league_admin");
    const button = fixture.nativeElement.querySelector(MENU_BUTTON);

    expect(button.textContent).toContain("Liga 2");
    expect(button.getAttribute("aria-label")).toBe(
      "Liga activa: Liga 2. Cambiar de liga",
    );
  });

  it("asks to choose when there are several leagues and none is active", () => {
    active.set(null);
    const fixture = setup("league_admin");

    expect(text(fixture)).toContain("Selecciona una liga");
  });

  it("switches league from the menu", () => {
    const fixture = setup("league_admin");
    fixture.nativeElement.querySelector(MENU_BUTTON).click();
    fixture.detectChanges();

    const items = document.querySelectorAll<HTMLElement>(
      "button[mat-menu-item]",
    );
    expect(items).toHaveLength(3);
    expect(items[1].getAttribute("aria-current")).toBe("true");

    items[2].click();
    expect(select).toHaveBeenCalledWith(3);
  });

  it("clears the selection with the button next to the selector", () => {
    const fixture = setup("league_admin");
    const button = fixture.nativeElement.querySelector(
      "button[aria-label='Limpiar liga']",
    );

    button.click();

    expect(clear).toHaveBeenCalled();
  });

  it("offers no clear button when none is active", () => {
    active.set(null);
    const fixture = setup("league_admin");

    expect(
      fixture.nativeElement.querySelector("button[aria-label='Limpiar liga']"),
    ).toBeNull();
  });

  it("filters a long list with the search box", () => {
    list.set(leagues(10));
    const fixture = setup("league_admin");
    fixture.nativeElement.querySelector(MENU_BUTTON).click();
    fixture.detectChanges();

    const input = document.querySelector<HTMLInputElement>(
      "input[type=search]",
    ) as HTMLInputElement;
    input.value = "liga 10";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    const items = document.querySelectorAll("button[mat-menu-item]");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Liga 10");
  });

  it("has no search box for a short list", () => {
    const fixture = setup("league_admin");
    fixture.nativeElement.querySelector(MENU_BUTTON).click();
    fixture.detectChanges();

    expect(document.querySelector("input[type=search]")).toBeNull();
  });

  it("shows a single league as plain text, without a menu", () => {
    list.set(leagues(1));
    active.set(list()[0]);
    const fixture = setup("league_admin");

    expect(text(fixture)).toContain("Liga 1");
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });

  it("shows the loading state", () => {
    list.set([]);
    active.set(null);
    loading.set(true);
    const fixture = setup("league_admin");

    expect(fixture.nativeElement.querySelector("mat-spinner")).not.toBeNull();
  });

  it("shows the error and retries", () => {
    list.set([]);
    active.set(null);
    failure.set(new Error("boom"));
    const fixture = setup("league_admin");

    expect(fixture.nativeElement.querySelector("[role=alert]")).not.toBeNull();
    fixture.nativeElement.querySelector("button").click();
    expect(reload).toHaveBeenCalled();
  });

  it("tells a league admin without leagues to contact the administrator", () => {
    list.set([]);
    active.set(null);
    const fixture = setup("league_admin");

    expect(text(fixture)).toContain(
      "Aún no tienes ligas asignadas, contacta al administrador",
    );
    expect(fixture.nativeElement.querySelector("a")).toBeNull();
  });

  it("sends the superadmin without leagues to create one", () => {
    list.set([]);
    active.set(null);
    const fixture = setup("superadmin");

    expect(fixture.nativeElement.querySelector("a").getAttribute("href")).toBe(
      "/dashboard/ligas",
    );
  });
});
