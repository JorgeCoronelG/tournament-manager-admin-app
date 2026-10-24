import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatDatepickerModule } from "@angular/material/datepicker";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { applyEach, form, FormField, validate } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { map, Observable, of, switchMap } from "rxjs";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { datesInOrder } from "../../groups/group.model";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import { failureMessage } from "../../../core/http/api-errors";
import {
  TieOrderDialogComponent,
  TieOrderDialogData,
} from "../tie-order-dialog/tie-order-dialog.component";
import {
  BestOfTable,
  CloseBlocker,
  CloseBody,
  ClosePreview,
  PlayoffBestOnly,
  PlayoffProposal,
  tiedSets,
} from "../playoff.model";
import { PlayoffsApi } from "../playoffs.api";

export interface ClosePhaseDialogData {
  tournamentId: number;
  /** Y-m-d of the last regular match that has a date, to show what the first playoff date must follow */
  lastRegularDate: string | null;
}

/** What closing the phase leaves to do: look at the standings, or nothing (it was closed) */
export type ClosePhaseResult = "closed" | "standings";

interface TieRow {
  position: number;
  a: number | "";
  b: number | "";
}

interface PlayoffRow {
  group_id: number;
  ties: TieRow[];
  dates: Array<{ date: Date | null }>;
}

/**
 * Shows what closing the regular phase would do. With blockers it only lists
 * them; without, each playoff's seeds, first-round pairings (adjustable) and
 * dates (editable) to confirm. Closes with what the page should do next.
 */
@Component({
  selector: "app-close-phase-dialog",
  templateUrl: "./close-phase-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormField,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class ClosePhaseDialogComponent {
  private readonly api = inject(PlayoffsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<ClosePhaseDialogComponent, ClosePhaseResult>>(
      MatDialogRef,
    );
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  protected readonly parseDate = parseDate;

  readonly data = inject<ClosePhaseDialogData>(MAT_DIALOG_DATA);

  readonly preview = rxResource<ClosePreview, number>({
    params: () => this.data.tournamentId,
    stream: ({ params }) => this.api.preview(params),
  });

  readonly blockers = computed(() => this.preview.value()?.blockers ?? []);
  readonly warnings = computed(() => this.preview.value()?.warnings ?? []);
  private readonly entries = computed(
    () => this.preview.value()?.playoffs ?? [],
  );

  /** Playoffs with a bracket to confirm: only when nothing blocks the closing */
  readonly proposals = computed(() =>
    this.entries().filter(
      (entry): entry is PlayoffProposal => "qualified" in entry,
    ),
  );

  /** The best-of-position comparisons, by playoff: they show even while something blocks the closing */
  readonly bestTables = computed(() =>
    this.entries()
      .map((entry: PlayoffProposal | PlayoffBestOnly) => ({
        name: entry.name,
        tables: entry.best_of ?? [],
      }))
      .filter((entry) => entry.tables.length > 0),
  );

  /** Sources whose tie blocks the closing: the others only get a notice */
  private readonly blockedSources = computed(
    () =>
      new Set(
        this.blockers().flatMap((blocker) => {
          const best = this.bestBlocker(blocker);

          return best ? [best.source_id] : [];
        }),
      ),
  );

  /** Sources where an order was saved in this dialog: the preview does not say if one exists */
  readonly savedOrder = signal<ReadonlySet<number>>(new Set());

  /** The backend's refusal (invalid pairings, dates...) */
  readonly formError = signal<string | null>(null);

  private readonly model = signal<{ playoffs: PlayoffRow[] }>({ playoffs: [] });
  readonly closeForm = form(this.model, (root) => {
    applyEach(root.playoffs, (playoff) => {
      validate(playoff.ties, ({ value }) => {
        const picked = value().flatMap((tie) => [tie.a, tie.b]);

        return picked.every((id) => id !== "") &&
          new Set(picked).size === picked.length
          ? undefined
          : { kind: "ties" };
      });
      validate(playoff.dates, ({ value }) => {
        const dates = value().map((row) => row.date);

        return dates.every((date) => date !== null) && datesInOrder(dates)
          ? undefined
          : { kind: "dates" };
      });
    });
  });

  // The form is filled when the proposal arrives
  private readonly fill = effect(() => {
    const proposals = this.proposals();

    untracked(() => this.initFrom(proposals));
  });

  /** Fills the form from the proposals */
  private initFrom(proposals: PlayoffProposal[]): void {
    this.model.set({
      playoffs: proposals.map((proposal) => ({
        group_id: proposal.group_id,
        ties: this.defaultTies(proposal),
        dates: proposal.dates.map((date) => ({ date: parseDate(date) })),
      })),
    });
  }

  private defaultTies(proposal: PlayoffProposal): TieRow[] {
    return (proposal.rounds[0]?.ties ?? []).map((tie) => ({
      position: tie.bracket_position,
      a: tie.team_a?.team_id ?? "",
      b: tie.team_b?.team_id ?? "",
    }));
  }

  /** "Restablecer cruces": back to best seed against worst seed */
  resetTies(index: number): void {
    const proposal = this.proposals()[index];

    this.model.update(({ playoffs }) => ({
      playoffs: playoffs.map((row, i) =>
        i === index ? { ...row, ties: this.defaultTies(proposal) } : row,
      ),
    }));
  }

  /** The team a pairing slot holds ("" when empty); slots are numbered `tie * 2 + side` */
  slotTeam(index: number, slot: number): number | "" {
    const tie = this.model().playoffs[index]?.ties[Math.floor(slot / 2)];

    return (slot % 2 === 0 ? tie?.a : tie?.b) ?? "";
  }

  /** Puts a team in a slot; if another slot of the playoff had it, that one takes the team this slot had (never a repeated team) */
  setSlot(index: number, slot: number, team: number): void {
    const previous = this.slotTeam(index, slot);

    this.model.update(({ playoffs }) => ({
      playoffs: playoffs.map((row, i) => {
        if (i !== index) {
          return row;
        }

        const slots = row.ties.flatMap((tie) => [tie.a, tie.b]);
        const other = slots.findIndex((id, s) => id === team && s !== slot);

        slots[slot] = team;

        if (other !== -1) {
          slots[other] = previous;
        }

        return {
          ...row,
          ties: row.ties.map((tie, t) => ({
            ...tie,
            a: slots[t * 2],
            b: slots[t * 2 + 1],
          })),
        };
      }),
    }));
  }

  /** "Cuartos de final", or "Semifinal (ida)" and "Semifinal (vuelta)" for each match */
  matchLabels(proposal: PlayoffProposal): string[] {
    return proposal.rounds.flatMap((round) =>
      round.legs === 2
        ? [
            this.transloco.translate("groups.playoff.legFirst", {
              name: round.name,
            }),
            this.transloco.translate("groups.playoff.legSecond", {
              name: round.name,
            }),
          ]
        : [round.name],
    );
  }

  /** Later rounds only as labels: "Semifinal (ida y vuelta)" */
  laterRounds(proposal: PlayoffProposal): string[] {
    return proposal.rounds.slice(1).map((round) =>
      round.legs === 2
        ? this.transloco.translate("groups.playoff.twoLegs", {
            name: round.name,
          })
        : round.name,
    );
  }

  firstRoundName(proposal: PlayoffProposal): string {
    return proposal.rounds[0]?.name ?? "";
  }

  firstRoundLegs(proposal: PlayoffProposal): boolean {
    return proposal.rounds[0]?.legs === 2;
  }

  blockerRange(positions: number[] | undefined): string {
    if (!positions?.length) {
      return "";
    }

    const [first, last] = [Math.min(...positions), Math.max(...positions)];

    return first === last ? `${first}` : `${first}-${last}`;
  }

  asPending(blocker: CloseBlocker) {
    return blocker.type === "pending_matches"
      ? (blocker as Extract<CloseBlocker, { type: "pending_matches" }>)
      : null;
  }

  asTies(blocker: CloseBlocker) {
    return blocker.type === "unresolved_ties" && !("scope" in blocker)
      ? (blocker as Extract<CloseBlocker, { positions: number[] }>)
      : null;
  }

  /** A tie among the best of a position that decides who qualifies */
  bestBlocker(blocker: CloseBlocker) {
    return blocker.type === "unresolved_ties" &&
      "scope" in blocker &&
      blocker.scope === "best_of_position"
      ? (blocker as Extract<CloseBlocker, { scope: "best_of_position" }>)
      : null;
  }

  /** Teams level in a comparison without it changing who qualifies: only a notice */
  hasInfoTie(table: BestOfTable): boolean {
    return (
      !this.blockedSources().has(table.source_id) && tiedSets(table).length > 0
    );
  }

  bestOf(proposal: PlayoffProposal, teamId: number): number | null {
    return (
      (proposal.best_of ?? []).find((table) =>
        table.table.some((row) => row.team_id === teamId && row.qualified),
      )?.position ?? null
    );
  }

  /** The order dialog for the tied teams of a comparison: the same one the standings use */
  defineBestOrder(sourceId: number): void {
    const table = this.bestTables()
      .flatMap((entry) => entry.tables)
      .find((candidate) => candidate.source_id === sourceId);

    if (!table) {
      return;
    }

    this.dialog
      .open<TieOrderDialogComponent, TieOrderDialogData, boolean>(
        TieOrderDialogComponent,
        {
          data: {
            title: this.transloco.translate("matches.close.bestOrder", {
              position: table.position,
            }),
            sets: tiedSets(table).map((set) =>
              set.map((row) => ({
                key: row.team_id,
                team_name: `${row.team_name} (${row.group})`,
                logo_url: null,
              })),
            ),
            save: (ids) =>
              this.api.saveBestManualOrder(
                this.data.tournamentId,
                sourceId,
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
          this.savedOrder.update((ids) => new Set(ids).add(sourceId));
          this.preview.reload();
        }
      });
  }

  clearBestOrder(sourceId: number): void {
    this.formError.set(null);
    this.confirmDialog
      .confirm({ key: "matches.close.clearBestOrder" })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api
          .clearBestManualOrder(this.data.tournamentId, sourceId)
          .subscribe({
            next: () => {
              this.savedOrder.update((ids) => {
                const next = new Set(ids);
                next.delete(sourceId);

                return next;
              });
              this.preview.reload();
            },
            error: (error: unknown) =>
              this.formError.set(
                failureMessage(error, (key) => this.transloco.translate(key)),
              ),
          });
      });
  }

  /** The user asks for the standings tab to set the manual order there */
  goToStandings(): void {
    this.dialogRef.close("standings");
  }

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.closeForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () =>
        this.confirmDialog
          .confirm({ key: "matches.close.confirmation", tone: "danger" })
          .pipe(
            switchMap((confirmed): Observable<ClosePhaseResult | null> =>
              confirmed
                ? this.api
                    .close(this.data.tournamentId, this.body())
                    .pipe(map((): ClosePhaseResult => "closed"))
                : of(null),
            ),
          ),
      onSuccess: (result) => {
        if (result) {
          this.dialogRef.close(result);
        }
      },
    });
  }

  private body(): CloseBody {
    return {
      liguillas: this.model().playoffs.map((playoff) => ({
        group_id: playoff.group_id,
        ties: playoff.ties.map((tie) => ({
          bracket_position: tie.position,
          team_a_id: tie.a as number,
          team_b_id: tie.b as number,
        })),
        round_dates: playoff.dates.map((row) => formatDate(row.date as Date)),
      })),
    };
  }
}
