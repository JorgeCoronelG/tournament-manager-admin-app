import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { Router, provideRouter } from "@angular/router";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { TournamentsApi } from "../tournaments.api";
import { TournamentHistoryComponent } from "./tournament-history.component";

describe("TournamentHistoryComponent", () => {
  function setup(mobile: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: mobile, breakpoints: {} }),
            isMatched: () => mobile,
          },
        },
        {
          provide: LeagueContextService,
          useValue: {
            activeLeagueId: signal(1),
            activeLeague: signal(null),
          },
        },
        {
          provide: TournamentsApi,
          useValue: {
            history: () => ({
              hasValue: () => true,
              value: () => ({ data: [], total: 0, meta: { total: 0 } }),
              isLoading: signal(false),
              error: signal(undefined),
              reload: vi.fn(),
            }),
            historyYears: () => ({
              hasValue: () => true,
              value: () => ({ data: [2026] }),
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TournamentHistoryComponent);

    return fixture.componentInstance;
  }

  it("puts the menu column first on phones and the actions last on desktop", () => {
    expect(setup(true).columns()[0]).toBe("actionsMenu");
    TestBed.resetTestingModule();
    expect(setup(false).columns().at(-1)).toBe("actions");
  });

  it("counts the year in the filters badge, not the search", () => {
    const component = setup(true);
    component.filters.set({ search: "copa", year: "" });
    expect(component.activeFilters()).toBe(0);
    component.filters.set({ search: "", year: 2026 });
    expect(component.activeFilters()).toBe(1);
  });

  it("offers to see the tournament from the menu", () => {
    const component = setup(true);
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    const [view] = component.rowActions({ id: 7 });

    expect(view.labelKey).toBe("tournaments.history.view");
    view.run();
    expect(navigate).toHaveBeenCalledWith([7], expect.anything());
  });
});
