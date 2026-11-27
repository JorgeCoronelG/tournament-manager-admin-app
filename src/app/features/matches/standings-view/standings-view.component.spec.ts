import { TestBed } from "@angular/core/testing";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { StandingsExportService } from "../standings-export/standings-export.service";
import { StandingsApi } from "../standings.api";
import { StandingsViewComponent } from "./standings-view.component";

describe("StandingsViewComponent", () => {
  function setup(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: StandingsApi, useValue: {} },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: SnackbarService, useValue: {} },
        { provide: LeagueContextService, useValue: {} },
        {
          provide: StandingsExportService,
          useValue: { canShareFiles: false },
        },
      ],
    });
    const fixture = TestBed.createComponent(StandingsViewComponent);
    fixture.componentRef.setInput("tournamentId", 1);
    fixture.componentRef.setInput("groups", [
      {
        group_id: 1,
        group_name: "A",
        criteria: [],
        ties: [],
        rows: [{ position: 1, registration_id: 1, team_name: "Búhos" }],
      },
    ]);
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  it("hides goals for and against only on phones", () => {
    const host = setup();
    const hidden = [...host.querySelectorAll("th")]
      .filter((th) => th.classList.contains("max-sm:!hidden"))
      .map((th) => th.textContent?.trim());

    expect(hidden).toEqual(["GF", "GC"]);
    expect(host.querySelectorAll("th")).toHaveLength(10);
  });

  it("writes the abbreviations out below sm and fills the export button", () => {
    const host = setup();

    expect(host.querySelector("p.sm\\:hidden")?.textContent).toContain(
      "Partidos jugados",
    );
    expect(host.querySelector("button[aria-busy]")?.classList).toContain(
      "w-full",
    );
  });
});
