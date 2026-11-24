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
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { StandingGroup, StandingPlayoff, StandingRow } from "../match.model";
import { colorByPriority } from "./playoff-palette";
import {
  TieOrderDialogComponent,
  TieOrderDialogData,
} from "../tie-order-dialog/tie-order-dialog.component";
import { StandingsApi } from "../standings.api";
import { StandingsExportService } from "../standings-export/standings-export.service";
import { buildImageData } from "../standings-export/standings-image.model";
import { SpinnerComponent } from "../../../shared/spinner/spinner.component";

/** The tables of the regular phase, a tab per group; tied teams can be ordered by hand while it is open */
@Component({
  selector: "app-standings-view",
  templateUrl: "./standings-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SpinnerComponent,
    LogoImageComponent,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class StandingsViewComponent {
  private readonly api = inject(StandingsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly exporter = inject(StandingsExportService);
  private readonly league = inject(LeagueContextService);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly tournamentId = input.required<number>();
  /** For the exported image */
  readonly tournamentName = input("");
  /** The tournament is over: the exported image says "Tabla final" */
  readonly finished = input(false);
  readonly groups = input.required<readonly StandingGroup[]>();
  /** The playoffs the table feeds: they colour the teams that qualify */
  readonly playoffs = input<readonly StandingPlayoff[]>([]);
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

  /** The image is being generated */
  protected readonly exporting = signal(false);

  /** The button shares the image (a phone) or downloads it (a desktop) */
  protected readonly canShare = this.exporter.canShareFiles;

  /** Generates the image of a group's table and shares or downloads it */
  async exportImage(group: StandingGroup): Promise<void> {
    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);

    try {
      const data = buildImageData({
        leagueName: this.league.activeLeague()?.name ?? "",
        tournamentName: this.tournamentName(),
        group,
        groupsCount: this.groups().length,
        playoffs: this.playoffs(),
        now: new Date(),
        final: this.finished(),
        legendLabel: (playoff) => this.legendLabel(playoff),
      });

      await this.exporter.export(data, this.tournamentName(), data.groupName);
    } catch {
      this.snackbar.error(
        this.transloco.translate("matches.standings.export.error"),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  /** The playoffs by priority with their colour: the same in every group and theme */
  protected readonly legend = computed(() => colorByPriority(this.playoffs()));

  private readonly playoffsById = computed(
    () => new Map(this.legend().map((item) => [item.playoff.id, item])),
  );

  /** The playoff a row qualifies to, with its colour */
  qualifying(row: StandingRow) {
    return row.playoff == null || row.playoff_pending
      ? null
      : (this.playoffsById().get(row.playoff.id) ?? null);
  }

  /** "Clasifica a Finales", or "Clasificación por definir" while a tie on the line decides it; empty otherwise */
  qualifyHint(row: StandingRow): string {
    if (row.playoff_pending) {
      return this.transloco.translate("matches.standings.qualifyPending");
    }

    const qualified = this.qualifying(row);

    return qualified
      ? this.transloco.translate("matches.standings.qualifiesTo", {
          name: qualified.playoff.name,
        })
      : "";
  }

  /** "Finales (1-2)": the positions text comes from the backend as it is */
  legendLabel(playoff: StandingPlayoff): string {
    return `${playoff.name} (${playoff.positions})`;
  }

  /** The tiebreakers of a group, in order, as text: "Puntos · Diferencia de goles..." */
  criteria(group: StandingGroup): string {
    return group.criteria
      .map((criterion) =>
        this.transloco.translate(`matches.tiebreaker.${criterion}`),
      )
      .join(" · ");
  }

  /** Ties only count once the group's regular matches are over: before that they can still resolve themselves */
  hasTies(group: StandingGroup): boolean {
    return group.ties_pending === true;
  }

  isTied(group: StandingGroup, row: StandingRow): boolean {
    return row.tied && this.hasTies(group);
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
          position: row.position,
        })),
    );

    this.dialog
      .open<TieOrderDialogComponent, TieOrderDialogData, boolean>(
        TieOrderDialogComponent,
        {
          data: {
            // With a single group there is no name to tell apart
            title: this.single()
              ? this.transloco.translate("matches.standings.order.titleSingle")
              : this.transloco.translate("matches.standings.order.title", {
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
          autoFocus: "dialog",
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
