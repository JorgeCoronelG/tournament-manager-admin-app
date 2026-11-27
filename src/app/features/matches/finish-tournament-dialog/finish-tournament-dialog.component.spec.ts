import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideTestI18n } from "../../../../testing/i18n";
import { FinishTournamentDialogComponent } from "./finish-tournament-dialog.component";

describe("FinishTournamentDialogComponent", () => {
  function setup(champions: Array<{ liguilla: string; team: string }>) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { tournamentName: "Apertura", champions },
        },
      ],
    });
    const fixture = TestBed.createComponent(FinishTournamentDialogComponent);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it("has no champions section without champions", () => {
    expect(setup([]).querySelector("section")).toBeNull();
  });

  it("lists each champion in a row that can wrap", () => {
    const host = setup([
      { liguilla: "Oro", team: "Águilas" },
      { liguilla: "Plata", team: "Búhos" },
    ]);
    const rows = host.querySelectorAll("section > div");

    expect(rows).toHaveLength(2);
    expect(rows[0].classList).toContain("flex-wrap");
    expect(host.textContent).toContain("Búhos");
  });
});
