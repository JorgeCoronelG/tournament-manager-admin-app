import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { of } from "rxjs";
import { provideTestI18n } from "../../../testing/i18n";
import { ConfirmDialogComponent } from "./confirm-dialog.component";
import { ConfirmDialogService } from "./confirm-dialog.service";

describe("ConfirmDialogService", () => {
  const open = vi.fn();

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: MatDialog, useValue: { open } },
      ],
    });
  });

  function confirm(result: boolean | undefined) {
    open.mockReturnValue({ afterClosed: () => of(result) });
    const emitted: boolean[] = [];

    TestBed.inject(ConfirmDialogService)
      .confirm({ key: "users.delete", params: { name: "Ana Pérez" } })
      .subscribe((value) => emitted.push(value));

    return emitted;
  }

  it("opens the dialog with the texts under the key, translated", () => {
    confirm(true);

    expect(open).toHaveBeenCalledWith(ConfirmDialogComponent, {
      autoFocus: "dialog",
      data: {
        title: "Eliminar usuario",
        message:
          "¿Seguro que quieres eliminar a Ana Pérez?\nEsta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
      },
    });
  });

  it("emits true only when the user confirms", () => {
    expect(confirm(true)).toEqual([true]);
    expect(confirm(undefined)).toEqual([false]);
    expect(confirm(false)).toEqual([false]);
  });
});
