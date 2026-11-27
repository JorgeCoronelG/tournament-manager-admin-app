import { TestBed } from "@angular/core/testing";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { of } from "rxjs";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { MatchesApi } from "../matches.api";
import { WalkoverDialogComponent } from "./walkover-dialog.component";

describe("WalkoverDialogComponent", () => {
  it("stacks the teams on phones and disables confirm without a loser", () => {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        {
          provide: BreakpointObserver,
          useValue: {
            observe: (q: string) =>
              of({ matches: q.includes("599"), breakpoints: {} }),
            isMatched: (q: string) => q.includes("599"),
          },
        },
        { provide: MatchesApi, useValue: {} },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            matchId: 1,
            tournamentId: 1,
            goals: 3,
            playoff: false,
            home: { registration_id: 1, name: "Local" },
            away: { registration_id: 2, name: "Visita" },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(WalkoverDialogComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain("vs");
    expect(host.querySelector(".sm\\:flex-row p")?.textContent).toContain(
      "Local",
    );
    const confirm = host.querySelector<HTMLButtonElement>(
      "button[type=submit]",
    );
    expect(confirm?.disabled).toBe(true);
    expect(confirm?.textContent?.trim()).toBe("Registrar");
    expect(confirm?.getAttribute("aria-label")).toBe(
      "Registrar victoria por default",
    );
  });
});
