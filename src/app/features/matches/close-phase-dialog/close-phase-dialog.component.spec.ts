import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { provideNativeDateAdapter } from "@angular/material/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { PlayoffsApi } from "../playoffs.api";
import { ClosePhaseDialogComponent } from "./close-phase-dialog.component";

const seed = (n: number, name: string) => ({
  seed: n,
  registration_id: n,
  team_id: n,
  team_name: name,
  source_group: "A",
  position: n,
});

const row = (id: number, qualified: boolean) => ({
  rank: id,
  registration_id: id,
  team_id: id,
  team_name: `Equipo ${id}`,
  group: "A",
  played: 3,
  points: 4,
  goal_difference: 1,
  goals_for: 3,
  points_per_match: 1.33,
  qualified,
  tied: false,
});

const PROPOSAL = {
  blockers: [],
  warnings: [],
  playoffs: [
    {
      group_id: 10,
      name: "Oro",
      qualified: [1, 2, 3, 4, 5, 6].map((n) => seed(n, `Equipo ${n}`)),
      rounds: [
        {
          name: "Semifinal",
          legs: 1,
          ties: [
            { bracket_position: 1, team_a: seed(1, "A"), team_b: seed(2, "B") },
          ],
        },
      ],
      dates: ["2026-12-07"],
      round_legs: [1],
      best_of: [
        {
          source_id: 7,
          position: 4,
          best_count: 1,
          table: [row(1, true), row(2, false)],
        },
      ],
    },
  ],
};

const BLOCKED = {
  blockers: [{ type: "no_calendar", message: "x" }],
  warnings: [],
  playoffs: [],
};

describe("ClosePhaseDialogComponent", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function () {
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
    );
  });
  afterAll(() => vi.unstubAllGlobals());

  async function setup(preview: unknown) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideNativeDateAdapter(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: () => of({ matches: true, breakpoints: {} }),
            isMatched: () => true,
          },
        },
        { provide: PlayoffsApi, useValue: { preview: () => of(preview) } },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tournamentId: 1,
            lastRegularDate: null,
            matchDuration: 60,
            tournamentStartDate: "2026-01-01",
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ClosePhaseDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return { host: fixture.nativeElement as HTMLElement };
  }

  const button = (host: HTMLElement, text: string) =>
    [...host.querySelectorAll("button")].filter(
      (b) => b.textContent?.trim() === text,
    );

  it("limits no list height on phones and offers cards beside the table", async () => {
    const { host } = await setup(PROPOSAL);

    expect(host.querySelector(".max-h-60")).toBeNull();
    expect(host.querySelector(".sm\\:max-h-60")).not.toBeNull();
    expect(host.querySelector("table")?.parentElement?.className).toContain(
      "max-sm:hidden",
    );
    expect(host.querySelectorAll("ul.sm\\:hidden li")).toHaveLength(2);
  });

  it("has a text button to reset the pairings, disabled with no changes", async () => {
    const { host } = await setup(PROPOSAL);
    const [reset] = button(host, "Restablecer cruces");

    expect(reset.disabled).toBe(true);
  });

  it("shows a single button when blocked", async () => {
    const { host } = await setup(BLOCKED);

    expect(host.querySelectorAll("mat-dialog-actions button").length).toBe(1);
  });
});
