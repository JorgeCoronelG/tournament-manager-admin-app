import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { appConfigs } from "@ui/config/app-configs";
import { provideApp } from "@ui/app.provider";
import { provideTestI18n } from "../../../../testing/i18n";
import { GroupsApi } from "../../groups/groups.api";
import { MatchesApi } from "../matches.api";
import { GenerateMatchesDialogComponent } from "./generate-matches-dialog.component";

describe("GenerateMatchesDialogComponent", () => {
  function setup(
    regenerate: boolean,
    assignments?: { scheduled: number; locked: number; referees: number },
  ): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        provideApp({ config: appConfigs.poseidon, availableThemes: [] }),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: MatchesApi, useValue: {} },
        {
          provide: GroupsApi,
          useValue: {
            view: () => ({
              value: signal({ regular: [] }),
              isLoading: signal(false),
            }),
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { tournamentId: 1, rounds: 1, regenerate, assignments },
        },
      ],
    });
    const fixture = TestBed.createComponent(GenerateMatchesDialogComponent);
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  const submit = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>("button[type=submit]")!;

  it("hides the checkbox's touch area only from sm upwards", () => {
    const checkbox = setup(false).querySelector("mat-checkbox")!;

    expect(checkbox.className).toContain(
      "sm:[&_.mat-mdc-checkbox-touch-target]:hidden",
    );
    expect(checkbox.className).toContain("max-sm:min-h-12");
  });

  it("offers to generate in the primary color", () => {
    const button = submit(setup(false));

    expect(button.textContent?.trim()).toBe("Generar");
    expect(button.classList).toContain("mat-primary");
  });

  it("offers to regenerate in the warn color", () => {
    const button = submit(setup(true));

    expect(button.textContent?.trim()).toBe("Regenerar");
    expect(button.classList).toContain("mat-warn");
  });

  it.each([
    [1, 0, "Se perderá 1 horario asignado."],
    [0, 1, "Se perderá 1 partido con árbitro asignado."],
    [2, 0, "Se perderán 2 horarios asignados."],
    [1, 1, "Se perderán 1 horario asignado y 1 partido con árbitro asignado."],
  ])(
    "agrees in number with %i schedules and %i referees",
    (scheduled, referees, text) => {
      const host = setup(true, { scheduled, locked: 0, referees });

      expect(host.textContent).toContain(text);
    },
  );
});
