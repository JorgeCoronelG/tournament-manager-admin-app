import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatTableModule } from "@angular/material/table";
import { MatTabsModule } from "@angular/material/tabs";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { StandingGroup, StandingRow } from "../match.model";
import {
  TieOrderDialogComponent,
  TieOrderDialogData,
} from "../tie-order-dialog/tie-order-dialog.component";
import { StandingsApi } from "../standings.api";

/** The tables of the regular phase, a tab per group; tied teams can be ordered by hand while it is open */
@Component({
  selector: "app-standings-view",
  templateUrl: "./standings-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LogoImageComponent,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class StandingsViewComponent {
  private readonly api = inject(StandingsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly tournamentId = input.required<number>();
  readonly groups = input.required<readonly StandingGroup[]>();
  /** Only a tournament in progress lets the order of tied teams be set */
  readonly editable = input(false);

  /** The order changed: the tables must be requested again */
  readonly changed = output<void>();

  protected readonly columns = [
    "position",
    "team",
    "played",
    "won",
    "drawn",
    "lost",
    "goals_for",
    "goals_against",
    "goal_difference",
    "points",
  ];

  /** Groups where the user saved an order in this session, for when the backend does not flag it */
  private readonly savedHere = signal<ReadonlySet<number>>(new Set());

  readonly selectedTab = signal(0);

  /** The tiebreakers of a group, in order, as text: "Puntos, Diferencia de goles..." */
  criteria(group: StandingGroup): string {
    return group.criteria
      .map((criterion) =>
        this.transloco.translate(`tournaments.tiebreaker.${criterion}`),
      )
      .join(", ");
  }

  /** Before any match is played everyone is level, which is nothing to resolve */
  private started(group: StandingGroup): boolean {
    return group.rows.some((row) => row.played > 0);
  }

  hasTies(group: StandingGroup): boolean {
    return group.ties.length > 0 && this.started(group);
  }

  isTied(group: StandingGroup, row: StandingRow): boolean {
    return row.tied && this.started(group);
  }

  hasManualOrder = (group: StandingGroup): boolean =>
    group.has_manual_order ?? this.savedHere().has(group.group_id);

  protected readonly single = computed(() => this.groups().length === 1);

  defineOrder(group: StandingGroup): void {
    if (!this.editable()) {
      return;
    }

    const byId = new Map(group.rows.map((row) => [row.registration_id, row]));
    const sets = group.ties.map((ids) =>
      ids
        .map((id) => byId.get(id))
        .filter((row): row is StandingRow => !!row)
        .map((row) => ({
          key: row.registration_id,
          team_name: row.team_name,
          logo_url: row.logo_url,
        })),
    );

    this.dialog
      .open<TieOrderDialogComponent, TieOrderDialogData, boolean>(
        TieOrderDialogComponent,
        {
          data: {
            title: this.transloco.translate("matches.standings.order.title", {
              group: group.group_name,
            }),
            sets,
            save: (ids) =>
              this.api.saveManualOrder(
                this.tournamentId(),
                group.group_id,
                ids,
              ),
          },
          width: "460px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.savedHere.update((ids) => new Set(ids).add(group.group_id));
          this.changed.emit();
          this.snackbar.notifySuccess("matches.standings.orderSaved");
        }
      });
  }

  clearOrder(group: StandingGroup): void {
    if (!this.editable()) {
      return;
    }

    this.confirmDialog
      .confirm({
        key: "matches.standings.clearOrder",
        params: { group: group.group_name },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api
          .clearManualOrder(this.tournamentId(), group.group_id)
          .subscribe({
            next: () => {
              this.savedHere.update((ids) => {
                const next = new Set(ids);
                next.delete(group.group_id);

                return next;
              });
              this.changed.emit();
              this.snackbar.notifySuccess("matches.standings.orderCleared");
            },
            error: (error: unknown) => this.snackbar.notifyFailure(error),
          });
      });
  }
}
