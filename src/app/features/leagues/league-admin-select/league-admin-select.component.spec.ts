import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideTestI18n } from "../../../../testing/i18n";
import { User } from "../../users/user.model";
import { UsersApi } from "../../users/users.api";
import { LeaguesApi } from "../leagues.api";
import { LeagueAdminSelectComponent } from "./league-admin-select.component";

const user = (id: number, status: User["status"] = "active"): User =>
  ({
    id,
    first_name: `Ana${id}`,
    last_name: "Pérez",
    email: `u${id}@example.com`,
    status,
  }) as User;

describe("LeagueAdminSelectComponent", () => {
  let candidates: ReturnType<typeof signal<User[] | undefined>>;
  let roles: ReturnType<typeof signal<Array<{ id: number; code: string }>>>;
  const adminCandidates = vi.fn();

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: UsersApi,
          useValue: {
            roles: () => ({
              value: roles,
              error: signal(undefined),
              hasValue: () => roles().length > 0,
              reload: vi.fn(),
            }),
          },
        },
        {
          provide: LeaguesApi,
          useValue: {
            adminCandidates: (
              role: () => number | undefined,
              s: () => string,
            ) => {
              adminCandidates(role, s);

              return {
                value: () => {
                  const data = candidates();

                  return data && { data };
                },
                hasValue: () => candidates() !== undefined,
                isLoading: () => false,
                error: signal(undefined),
                reload: vi.fn(),
              };
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(LeagueAdminSelectComponent);
    fixture.componentRef.setInput("label", "Encargado");
    fixture.detectChanges();

    return fixture;
  }

  function input(fixture: ReturnType<typeof setup>): HTMLInputElement {
    return fixture.debugElement.query(By.css("input")).nativeElement;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    adminCandidates.mockReset();
    candidates = signal<User[] | undefined>([user(1), user(2, "inactive")]);
    roles = signal([{ id: 3, code: "league_admin" }]);
  });

  afterEach(() => vi.useRealTimers());

  it("looks for the league_admin role by code, never by number", () => {
    const fixture = setup();
    const [roleId] = adminCandidates.mock.calls[0];

    expect(roleId()).toBe(3);
    expect(fixture.componentInstance.unavailable()).toBe(false);

    roles.set([{ id: 9, code: "player" }]);
    expect(roleId()).toBeUndefined();
    expect(fixture.componentInstance.unavailable()).toBe(true);
  });

  it("debounces the search while the user types", () => {
    const fixture = setup();
    const element = input(fixture);

    element.value = "an";
    element.dispatchEvent(new Event("input"));
    element.value = "ana";
    element.dispatchEvent(new Event("input"));

    expect(fixture.componentInstance.search()).toBe("");
    vi.advanceTimersByTime(300);
    expect(fixture.componentInstance.search()).toBe("ana");
  });

  it("picks an option and clears the choice when the text is edited", () => {
    const fixture = setup();
    const { componentInstance: select } = fixture;

    select.choose(user(1));
    expect(select.value()).toBe(1);
    expect(select.text()).toBe("Ana1 Pérez");

    const element = input(fixture);
    element.value = "Ana";
    element.dispatchEvent(new Event("input"));
    expect(select.value()).toBe("");
  });

  it("clears the text and the choice with the clear button", () => {
    const fixture = setup();
    const { componentInstance: select } = fixture;
    expect(fixture.nativeElement.querySelector("button")).toBeNull();

    select.choose(user(1));
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();

    expect(select.value()).toBe("");
    expect(select.text()).toBe("");
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });

  it("unchecks the option that was picked when it is cleared", async () => {
    const fixture = setup();
    const selected = () =>
      document.querySelector("mat-option")?.getAttribute("aria-selected");

    input(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLElement>("mat-option")?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    input(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(selected()).toBe("true");

    fixture.nativeElement.querySelector("button").click();
    fixture.detectChanges();
    await fixture.whenStable();

    input(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(selected()).toBe("false");
  });

  it("shows the name of the current manager", () => {
    const fixture = setup();
    fixture.componentRef.setInput("selected", {
      id: 1,
      first_name: "Luis",
      last_name: "Gómez",
      email: "l@example.com",
      status: "active",
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.text()).toBe("Luis Gómez");
  });

  it("offers the inactive users disabled, with their status", async () => {
    const fixture = setup();
    input(fixture).dispatchEvent(new Event("focusin"));
    input(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = document.querySelectorAll("mat-option");
    expect(options).toHaveLength(2);
    expect(options[0].getAttribute("aria-disabled")).toBe("false");
    expect(options[1].getAttribute("aria-disabled")).toBe("true");
    expect(options[1].textContent).toContain("Inactivo");
    expect(options[1].textContent).toContain("u2@example.com");
  });

  it("links to the users page when nothing matches", () => {
    candidates.set([]);
    const fixture = setup();

    const link = fixture.nativeElement.querySelector("a");
    expect(link.getAttribute("href")).toBe("/dashboard/usuarios");
  });

  it("shows the error text only once touched", () => {
    const fixture = setup();
    fixture.componentRef.setInput("errors", [{ kind: "required" }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("mat-error")).toBeNull();

    fixture.componentRef.setInput("touched", true);
    // The input's error state is refreshed on a check of its own
    fixture.detectChanges();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector("mat-error").textContent,
    ).toContain("Este campo es obligatorio");
  });
});
