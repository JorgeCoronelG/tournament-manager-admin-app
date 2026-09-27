import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { provideTestI18n } from "../../../../testing/i18n";
import { ValidationErrorsDialogComponent } from "./validation-errors-dialog.component";

describe("ValidationErrorsDialogComponent", () => {
  it("shows the messages it was given", () => {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MAT_DIALOG_DATA, useValue: ["First error", "Second error"] },
      ],
    });

    const fixture = TestBed.createComponent(ValidationErrorsDialogComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.messages).toEqual([
      "First error",
      "Second error",
    ]);
    expect(fixture.nativeElement.textContent).toContain("First error");
    expect(fixture.nativeElement.textContent).toContain("Second error");
  });
});
