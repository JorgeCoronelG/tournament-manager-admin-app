import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { MatchesApi } from "../matches.api";
import { BracketPlayoff } from "../playoff.model";
import { PlayoffResultsImageComponent } from "../playoff-image/playoff-results-image.component";
import { PlayoffScheduleImageComponent } from "../playoff-image/playoff-schedule-image.component";
import { bracketMatch, round, tie } from "../playoff-image/playoff-fixtures";
import { StandingsExportService } from "../standings-export/standings-export.service";
import { BracketViewComponent } from "./bracket-view.component";

describe("BracketViewComponent download menu", () => {
  const exportComponent = vi.fn();

  const playoffs = (
    legs: 1 | 2,
    results: { first?: boolean; second?: boolean } = {},
  ): BracketPlayoff[] => [
    {
      group_id: 1,
      name: "Liguilla (1-4)",
      champion: null,
      rounds: [
        round(
          [
            tie(
              legs === 1
                ? [
                    bracketMatch(1, {
                      ...(results.first
                        ? { status: "played", home_goals: 1, away_goals: 0 }
                        : {}),
                    }),
                  ]
                : [
                    bracketMatch(1, {
                      leg: 1,
                      ...(results.first
                        ? { status: "played", home_goals: 1, away_goals: 0 }
                        : {}),
                    }),
                    bracketMatch(2, {
                      leg: 2,
                      ...(results.second
                        ? { status: "played", home_goals: 1, away_goals: 1 }
                        : {}),
                    }),
                  ],
            ),
          ],
          legs,
        ),
      ],
    },
  ];

  function setup(
    data: BracketPlayoff[],
  ): ComponentFixture<BracketViewComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatchesApi, useValue: {} },
        { provide: TournamentsApi, useValue: {} },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
        {
          provide: LeagueContextService,
          useValue: { activeLeague: signal({ name: "Liga Demo" }) },
        },
        { provide: StandingsExportService, useValue: { exportComponent } },
      ],
    });

    const fixture = TestBed.createComponent(BracketViewComponent);
    fixture.componentRef.setInput("tournamentId", 1);
    fixture.componentRef.setInput("tournamentName", "Torneo Cuatro");
    fixture.componentRef.setInput("playoffs", data);
    fixture.detectChanges();

    return fixture;
  }

  const items = () => [
    ...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
  ];
  const item = (text: string) =>
    items().find((button) => button.textContent?.includes(text))!;

  async function open(fixture: ComponentFixture<BracketViewComponent>) {
    fixture.nativeElement
      .querySelector('button[aria-label="Descargar imagen"]')
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function click(
    fixture: ComponentFixture<BracketViewComponent>,
    text: string,
  ) {
    item(text).click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    exportComponent.mockReset();
    exportComponent.mockResolvedValue("downloaded");
  });

  afterEach(() => {
    document.querySelectorAll(".cdk-overlay-container").forEach((node) => {
      node.innerHTML = "";
    });
  });

  it("downloads straight from a single-match round", async () => {
    const fixture = setup(playoffs(1, { first: true }));

    await open(fixture);
    expect(
      items().map((button) => button.getAttribute("aria-disabled")),
    ).toEqual(["false", "false"]);
    await click(fixture, "Horarios");

    expect(exportComponent).toHaveBeenCalledTimes(1);
    expect(exportComponent.mock.calls[0][0]).toBe(
      PlayoffScheduleImageComponent,
    );
    expect(exportComponent.mock.calls[0][2]).toBe(
      "horarios-semifinal-torneo-cuatro.png",
    );
  });

  it("downloads the results of a single-match round", async () => {
    const fixture = setup(playoffs(1, { first: true }));

    await open(fixture);
    await click(fixture, "Resultados");

    expect(exportComponent.mock.calls[0][0]).toBe(PlayoffResultsImageComponent);
    expect(exportComponent.mock.calls[0][2]).toBe(
      "resultados-semifinal-torneo-cuatro.png",
    );
  });

  it("disables Resultados, with its hint, while nothing has a score", async () => {
    const fixture = setup(playoffs(1));

    await open(fixture);

    expect(item("Resultados").getAttribute("aria-disabled")).toBe("true");
    expect(item("Resultados").textContent).toContain(
      "Aún no hay resultados en esta fase",
    );
    expect(item("Horarios").getAttribute("aria-disabled")).toBe("false");
  });

  it("opens a submenu with Ida, Vuelta and Ambas for a home-and-away round", async () => {
    const fixture = setup(playoffs(2, { first: true, second: true }));

    await open(fixture);
    expect(exportComponent).not.toHaveBeenCalled();
    expect(item("Horarios").getAttribute("aria-haspopup")).toBe("menu");

    await click(fixture, "Horarios");

    expect(items().map((button) => button.textContent?.trim())).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Ida"),
        expect.stringContaining("Vuelta"),
        expect.stringContaining("Ambas"),
      ]),
    );

    await click(fixture, "Vuelta");

    expect(exportComponent.mock.calls[0][2]).toBe(
      "horarios-semifinal-vuelta-torneo-cuatro.png",
    );
  });

  it("enables each leg of Resultados only when it has a score", async () => {
    const fixture = setup(playoffs(2, { first: true }));

    await open(fixture);
    await click(fixture, "Resultados");

    expect(item("Ida").getAttribute("aria-disabled")).toBe("false");
    expect(item("Vuelta").getAttribute("aria-disabled")).toBe("true");
    expect(item("Ambas").getAttribute("aria-disabled")).toBe("false");
  });

  it("does not open a submenu of Resultados without any score", async () => {
    const fixture = setup(playoffs(2));

    await open(fixture);

    expect(item("Resultados").getAttribute("aria-disabled")).toBe("true");
  });

  it("updates without reloading when a score is captured", async () => {
    const fixture = setup(playoffs(1));

    await open(fixture);
    expect(item("Resultados").getAttribute("aria-disabled")).toBe("true");
    document.body.click();
    fixture.componentRef.setInput("playoffs", playoffs(1, { first: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    document
      .querySelectorAll(".cdk-overlay-backdrop")
      .forEach((node) => (node as HTMLElement).click());
    await open(fixture);

    expect(item("Resultados").getAttribute("aria-disabled")).toBe("false");
  });
});
