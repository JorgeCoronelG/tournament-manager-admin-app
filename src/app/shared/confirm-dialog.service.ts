import { inject, Service } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslocoService } from "@jsverse/transloco";
import { map, Observable } from "rxjs";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "./confirm-dialog.component";

export interface ConfirmOptions {
  /**
   * Translation key prefix: `<key>.title`, `<key>.message` and `<key>.confirm`
   * (e.g. `users.delete`) are the dialog's title, text and confirm button
   */
  key: string;
  /** Values for the message, e.g. `{ name: "Ana Pérez" }` */
  params?: Record<string, unknown>;
}

/** Asks the user to confirm a destructive action */
@Service()
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  /** Emits once: `true` if the user confirmed, `false` if they cancelled or dismissed it */
  confirm({ key, params }: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
        ConfirmDialogComponent,
        {
          // Focus the dialog itself, not its first button: nothing looks selected,
          // and the focus trap and Escape still work
          autoFocus: "dialog",
          data: {
            title: this.transloco.translate(`${key}.title`),
            message: this.transloco.translate(`${key}.message`, params),
            confirmLabel: this.transloco.translate(`${key}.confirm`),
          },
        },
      )
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }
}
