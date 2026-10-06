import { Component, signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideTestI18n } from "../../../testing/i18n";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { MyLeague } from "../../core/league-context/my-league.model";
import { CurrentUserService } from "../../core/user/current-user.service";
import { LeagueRequiredComponent } from "./league-required.component";

@Component({
  imports: [LeagueRequiredComponent],
  template: `<app-league-required><p>contenido</p></app-league-required>`,
})
class HostComponent {}

describe("LeagueRequiredComponent", () => {
  const reload = vi.fn();
  let list: WritableSignal<MyLeague[]>;
  let active: WritableSignal<MyLeague | null>;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideRouter([]),
        {
          provide: LeagueContextService,
          useValue: {
            leagues: list,
            activeLeague: active,
            isLoading: signal(false),
            error: signal(undefined),
            reload,
          },
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

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    list = signal([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
    active = signal<MyLeague | null>(null);
  });

  it("shows the screen once there is an active league", () => {
    active.set(list()[0]);

    expect(setup().textContent).toContain("contenido");
  });

  it("asks to pick a league instead of the screen", () => {
    const element = setup();

    expect(element.textContent).not.toContain("contenido");
    expect(element.textContent).toContain("Selecciona una liga");
  });

  it("tells a league admin with no leagues to contact the administrator", () => {
    list.set([]);

    expect(setup().textContent).toContain("contacta al administrador");
  });
});
