import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatIconRegistry } from "@angular/material/icon";
import { FakeMatIconRegistry } from "@angular/material/icon/testing";
import { provideTestI18n } from "../../../../testing/i18n";
import { TieOrderDialogComponent } from "./tie-order-dialog.component";

describe("TieOrderDialogComponent", () => {
  it("hides the logos on phones", () => {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: "x",
            sets: [[{ key: 1, team_name: "Búhos", logo_url: null }]],
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TieOrderDialogComponent);
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function () {
        return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
      }),
    );
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector("app-logo-image")
        ?.classList,
    ).toContain("max-sm:!hidden");
    vi.unstubAllGlobals();
  });
});
