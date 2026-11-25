import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { MatchesApi } from "../matches.api";
import { Match } from "../match.model";
import { MatchResultDialogComponent } from "./match-result-dialog.component";

const side = (id: number, name: string) => ({
  registration_id: id,
  team_id: id,
  team_name: name,
  logo_url: null,
});

describe("MatchResultDialogComponent", () => {
  function setup(mobile: boolean, status: string) {
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
        { provide: MatchesApi, useValue: {} },
        { provide: ConfirmDialogService, useValue: { confirm: vi.fn() } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tournamentId: 1,
            match: {
              id: 1,
              status,
              home_score: null,
              away_score: null,
              home: side(1, "Local"),
              away: side(2, "Visita"),
            } as Match,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MatchResultDialogComponent);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it("stacks the fields on phones with the team name above", () => {
    const host = setup(true, "scheduled");

    expect(host.querySelector(".flex-col.sm\\:flex-row")).not.toBeNull();
    expect(host.textContent).toContain("Local");
    expect(host.querySelector("input")?.getAttribute("min")).toBe("0");
  });

  it("offers void only for a played match", () => {
    expect(setup(true, "scheduled").textContent).not.toContain("Anular");
    TestBed.resetTestingModule();
    expect(setup(true, "played").textContent).toContain("Anular resultado");
  });
});
