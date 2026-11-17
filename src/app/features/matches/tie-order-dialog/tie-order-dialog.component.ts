import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { form } from "@angular/forms/signals";
import { TranslocoPipe } from "@jsverse/transloco";
import { concat, last, Observable } from "rxjs";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { ScrollFadeComponent } from "../../../shared/scroll-fade/scroll-fade.component";

/** A tied team: `key` is what `save` receives to name it */
export interface TieTeam {
  key: number;
  team_name: string;
  logo_url: string | null;
  /** The position the team holds in the table (the same for all of a tied set); without it the list is numbered from 1 */
  position?: number;
}

export interface TieOrderDialogData {
  title: string;
  /** Teams of each set that is still tied, in the order they are shown */
  sets: TieTeam[][];
  /** Saves the order of one set: the keys of its teams, best first */
  save: (keys: number[]) => Observable<unknown>;
}

/**
 * Orders the teams of every tied set of a group (best first). One list per set;
 * each is saved on its own request. Closes with `true` once they are saved.
 */
@Component({
  selector: "app-tie-order-dialog",
  templateUrl: "./tie-order-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LogoImageComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    ScrollFadeComponent,
    TranslocoPipe,
  ],
})
export class TieOrderDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<TieOrderDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);

  readonly data = inject<TieOrderDialogData>(MAT_DIALOG_DATA);

  readonly formError = signal<string | null>(null);

  private readonly model = signal({ sets: this.data.sets });
  readonly sets = () => this.model().sets;
  readonly orderForm = form(this.model);

  /** More than six tied teams: the lists scroll inside the dialog */
  readonly scrolls =
    this.data.sets.reduce((total, set) => total + set.length, 0) > 6;

  /** The first position of each set: the teams take it and the following ones as they are ordered */
  readonly starts = this.data.sets.map((set) => {
    const positions = set.flatMap((row) => row.position ?? []);

    return positions.length ? Math.min(...positions) : null;
  });

  /** "2–3" for the positions a set covers; null when they are not known */
  range(set: number): string | null {
    const start = this.starts[set];
    const size = this.data.sets[set]?.length ?? 0;

    return start === null || start === undefined
      ? null
      : `${start}–${start + size - 1}`;
  }

  move(set: number, index: number, step: -1 | 1): void {
    this.model.update(({ sets }) => ({
      sets: sets.map((rows, i) => {
        if (i !== set) {
          return rows;
        }

        const next = [...rows];
        [next[index], next[index + step]] = [next[index + step], next[index]];

        return next;
      }),
    }));
  }

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.orderForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () =>
        concat(
          ...this.model().sets.map((rows) =>
            this.data.save(rows.map((row) => row.key)),
          ),
        ).pipe(last()),
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
