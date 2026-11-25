import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MatDialog } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { MatchesApi } from "../matches.api";
import { BracketMatch, BracketPlayoff, BracketRound } from "../playoff.model";
import {
  bracketMatch,
  round,
  team,
  tie,
} from "../playoff-image/playoff-fixtures";
import { StandingsExportService } from "../standings-export/standings-export.service";
import { BracketViewComponent } from "./bracket-view.component";

const playoff = (rounds: BracketRound[]): BracketPlayoff => ({
  group_id: 1,
  name: "Oro",
  champion: null,
  rounds,
});

const labels = (actions: Array<{ labelKey: string }>) =>
  actions.map((action) => action.labelKey.split(".").slice(-2).join("."));

describe("BracketViewComponent on phones", () => {
  function setup({
    data,
    mobile = true,
    editable = true,
    schedulable = true,
    withdrawn = [] as number[],
  }: {
    data: BracketPlayoff[];
    mobile?: boolean;
    editable?: boolean;
    schedulable?: boolean;
    withdrawn?: number[];
  }): ComponentFixture<BracketViewComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (q: string) =>
              of({ matches: mobile && q.includes("599"), breakpoints: {} }),
            isMatched: (q: string) => mobile && q.includes("599"),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatchesApi, useValue: {} },
        { provide: TournamentsApi, useValue: {} },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
        {
          provide: LeagueContextService,
          useValue: { activeLeague: signal({ name: "Liga Demo" }) },
        },
        { provide: StandingsExportService, useValue: {} },
      ],
    });

    const fixture = TestBed.createComponent(BracketViewComponent);
    fixture.componentRef.setInput("tournamentId", 1);
    fixture.componentRef.setInput("tournamentName", "Torneo");
    fixture.componentRef.setInput("playoffs", data);
    fixture.componentRef.setInput("editable", editable);
    fixture.componentRef.setInput("schedulable", schedulable);
    fixture.componentRef.setInput("withdrawnIds", new Set(withdrawn));
    fixture.detectChanges();

    return fixture;
  }

  const semi = (matches: BracketMatch[], index = 1) => ({
    ...round([tie(matches)], 1),
    index,
  });
  const final = (index = 2) => ({
    ...round(
      [tie([bracketMatch(9)], { winner_registration_id: null })],
      1,
      "Final",
    ),
    index,
  });

  describe("matchActions", () => {
    const actionsOf = (
      fixture: ComponentFixture<BracketViewComponent>,
      data: BracketPlayoff,
      match: BracketMatch,
    ) =>
      fixture.componentInstance.matchActions(
        data,
        data.rounds[0],
        data.rounds[0].ties[0],
        match,
      );

    it("offers program, walkover and the result of a scheduled match", () => {
      const match = bracketMatch(1);
      const data = playoff([semi([match]), final()]);
      const actions = actionsOf(setup({ data: [data] }), data, match);

      expect(labels(actions)).toEqual([
        "program.action",
        "walkover.action",
        "bracket.register",
      ]);
      expect(actions[2].disabled).toBe(false);
      expect(actions[2].hint).toBeUndefined();
    });

    it("offers only to edit the result of a played match", () => {
      const match = bracketMatch(1, {
        status: "played",
        home_goals: 2,
        away_goals: 1,
      });
      const data = playoff([semi([match]), final()]);

      expect(labels(actionsOf(setup({ data: [data] }), data, match))).toEqual([
        "result.editTooltip",
      ]);
    });

    it("disables the result, with the reason, once a later round has results", () => {
      const match = bracketMatch(1, {
        status: "played",
        home_goals: 1,
        away_goals: 0,
      });
      const later = {
        ...round(
          [
            tie([
              bracketMatch(9, {
                status: "played",
                home_goals: 1,
                away_goals: 0,
              }),
            ]),
          ],
          1,
          "Final",
        ),
        index: 2,
      };
      const data = playoff([semi([match]), later]);
      const result = actionsOf(setup({ data: [data] }), data, match).at(-1);

      expect(result?.disabled).toBe(true);
      expect(result?.hint).toContain("siguiente ronda");
    });

    it("disables the result of a match with a withdrawn team and says why", () => {
      const match = bracketMatch(1);
      const data = playoff([semi([match]), final()]);
      const actions = actionsOf(
        setup({ data: [data], withdrawn: [1] }),
        data,
        match,
      );

      expect(actions.at(-1)?.disabled).toBe(true);
      expect(actions.at(-1)?.hint).toContain("Ganado por default");
      expect(labels(actions)).toContain("walkover.action");
    });

    it("has no result or walkover for a match whose teams are not defined", () => {
      const match = bracketMatch(1, { home_team: null });
      const data = playoff([semi([match]), final()]);

      expect(labels(actionsOf(setup({ data: [data] }), data, match))).toEqual([
        "program.action",
      ]);
    });

    it("has no menu when the bracket cannot change", () => {
      const match = bracketMatch(1);
      const data = playoff([semi([match]), final()]);
      const view = setup({ data: [data], editable: false, schedulable: false });

      expect(actionsOf(view, data, match)).toEqual([]);
      expect(
        (view.nativeElement as HTMLElement).querySelector("app-row-actions"),
      ).toBeNull();
    });
  });

  describe("rounds", () => {
    const headers = (fixture: ComponentFixture<BracketViewComponent>) => [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        "button[data-round-toggle]",
      ),
    ];

    it("opens only the current round", () => {
      const data = playoff([
        semi([bracketMatch(1)], 1),
        { ...final(2), ties: final(2).ties },
      ]);
      // the semifinal is decided, so the final is the current round
      data.rounds[0].ties[0].winner_registration_id = 1;
      const fixture = setup({ data: [data] });

      expect(
        headers(fixture).map((h) => h.getAttribute("aria-expanded")),
      ).toEqual(["false", "true"]);
      expect(
        (fixture.nativeElement as HTMLElement).querySelectorAll("article"),
      ).toHaveLength(1);
    });

    it("opens the last round when every tie is decided", () => {
      const data = playoff([semi([bracketMatch(1)], 1), final(2)]);
      data.rounds.forEach((r) =>
        r.ties.forEach((t) => (t.winner_registration_id = 1)),
      );
      const fixture = setup({ data: [data] });

      expect(
        headers(fixture).map((h) => h.getAttribute("aria-expanded")),
      ).toEqual(["false", "true"]);
    });

    it("keeps what the user opened until the bracket is reloaded", () => {
      const data = playoff([semi([bracketMatch(1)], 1), final(2)]);
      const fixture = setup({ data: [data] });
      const states = () =>
        headers(fixture).map((h) => h.getAttribute("aria-expanded"));

      expect(states()).toEqual(["true", "false"]);
      headers(fixture)[1].click();
      fixture.detectChanges();
      fixture.componentRef.setInput("editable", false);
      fixture.detectChanges();
      expect(states()).toEqual(["true", "true"]);

      fixture.componentRef.setInput("playoffs", [{ ...data }]);
      fixture.detectChanges();
      expect(states()).toEqual(["true", "false"]);
    });

    it("keeps the columns on desktop", () => {
      const data = playoff([semi([bracketMatch(1)], 1), final(2)]);
      const fixture = setup({ data: [data], mobile: false });

      expect(headers(fixture)).toHaveLength(0);
      expect(
        (fixture.nativeElement as HTMLElement).querySelectorAll("article"),
      ).toHaveLength(2);
    });
  });

  it("hides the logos and stacks the teams of a match on phones", () => {
    const data = playoff([semi([bracketMatch(1)], 1), final(2)]);
    data.rounds[0].ties[0].winner_registration_id = 1;
    data.rounds[0].ties[0].team_a = team(1, "Halcones");
    const fixture = setup({ data: [data] });
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector("app-logo-image")).toBeNull();
    expect(host.querySelector("app-row-actions")).not.toBeNull();
  });
});
