import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatRadioModule } from "@angular/material/radio";
import { Observable } from "rxjs";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { parseDate } from "../../tournaments/tournament.model";
import { ScheduleApi } from "../schedule.api";
import {
  SchedulePhase,
  ScheduleMode,
  SchedulePreview,
  ScheduleProposal,
  ScheduleScope,
  slotLabel,
} from "../schedule.model";

/** A matchday (or a playoff round) of the preview with its proposed matches */
interface ProposalGroup {
  key: string;
  number: number;
  title: string;
  /** "02 nov – 08 nov de 2026" */
  range: string | null;
  total: number;
  scheduled: number;
  matches: ScheduleProposal[];
}

const dayMonth = (date: Date) =>
  date.toLocaleDateString("es", { day: "2-digit", month: "short" });

/** "02 nov – 08 nov de 2026", or one day when both ends are the same */
function rangeLabel(start: Date, end: Date): string {
  const year = end.getFullYear();

  return start.getTime() === end.getTime()
    ? `${dayMonth(end)} de ${year}`
    : `${dayMonth(start)} – ${dayMonth(end)} de ${year}`;
}

export interface AssignScheduleDialogData {
  tournamentId: number;
  /** The bracket's matches ("playoffs") or the regular phase's; the regular phase by default */
  phase?: SchedulePhase;
}

/**
 * Assigns day, hour and field to the matches: the mode and scope are chosen,
 * the preview shows what would happen and only then can it be assigned. Closes
 * with `true` once assigned.
 */
@Component({
  selector: "app-assign-schedule-dialog",
  templateUrl: "./assign-schedule-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    MatRadioModule,
    TranslocoPipe,
  ],
})
export class AssignScheduleDialogComponent {
  private readonly api = inject(ScheduleApi);
  private readonly dialogRef =
    inject<MatDialogRef<AssignScheduleDialogComponent, boolean>>(MatDialogRef);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<AssignScheduleDialogData>(MAT_DIALOG_DATA);

  readonly mode = signal<ScheduleMode>("balanced");
  readonly scope = signal<ScheduleScope>("all");
  /** Playoffs: the finals are scheduled together at the end of the day */
  readonly alignFinals = signal(true);

  readonly playoffs = this.data.phase === "playoffs";

  /** Only valid for the mode and scope it was asked with: changing them drops it */
  readonly preview = signal<SchedulePreview | undefined>(undefined);
  readonly working = signal(false);
  readonly error = signal<string | null>(null);

  readonly parseDate = parseDate;

  /** The proposed matches by matchday (regular phase) or by round (playoffs) */
  readonly groups = computed<ProposalGroup[]>(() => {
    const result = this.preview();

    if (!result) {
      return [];
    }

    if (!this.playoffs) {
      return result.matchdays.map((day) => ({
        key: String(day.matchday),
        number: day.matchday,
        title: this.transloco.translate("matches.matchday", {
          number: day.matchday,
        }),
        range:
          day.week_start && day.week_end
            ? rangeLabel(parseDate(day.week_start), parseDate(day.week_end))
            : null,
        total: day.matches,
        scheduled: day.scheduled,
        matches: result.matches.filter((m) => m.matchday === day.matchday),
      }));
    }

    const rounds = new Map<string, ScheduleProposal[]>();

    for (const match of result.matches) {
      const key = this.roundName(match.round_name ?? "", match.leg ?? null);

      rounds.set(key, [...(rounds.get(key) ?? []), match]);
    }

    return [...rounds].map(([title, matches], index) => {
      const dates = matches
        .filter((m) => m.match_datetime)
        .map((m) => parseDate((m.match_datetime as string).slice(0, 10)))
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        key: title,
        number: index + 1,
        title,
        range: dates.length
          ? rangeLabel(dates[0], dates[dates.length - 1])
          : null,
        total: matches.length,
        scheduled: dates.length,
        matches,
      };
    });
  });

  /** "Sáb, 07 nov · 9:00 a. m." */
  when(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const time = date.toLocaleTimeString("es", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
  }

  setMode(mode: ScheduleMode): void {
    this.mode.set(mode);
    this.preview.set(undefined);
  }

  setAlignFinals(align: boolean): void {
    this.alignFinals.set(align);
    this.preview.set(undefined);
  }

  setScope(scope: ScheduleScope): void {
    this.scope.set(scope);
    this.preview.set(undefined);
  }

  /** "Semifinal (ida)" for a round played home and away */
  roundName(name: string, leg: number | null): string {
    return leg === null
      ? name
      : `${name} (${this.transloco.translate(leg === 1 ? "matches.bracket.first" : "matches.bracket.second").toLowerCase()})`;
  }

  slot(iso: string, field: string | null | undefined): string {
    return slotLabel(iso, field, (weekday) =>
      this.transloco.translate(`matches.config.weekdays.${weekday}`),
    );
  }

  calculate(): void {
    this.run(
      this.api.preview(this.data.tournamentId, this.options()),
      (result) => this.preview.set(result),
    );
  }

  assign(): void {
    if (!this.preview()) {
      return;
    }

    this.run(
      this.api.generate(this.data.tournamentId, this.generateOptions()),
      () => this.dialogRef.close(true),
    );
  }

  private options() {
    return this.playoffs
      ? {
          phase: "playoffs" as const,
          scope: this.scope(),
          align_finals: this.alignFinals(),
        }
      : { mode: this.mode(), scope: this.scope() };
  }

  /** Generating repeats the preview's draw, so the result is what was shown */
  private generateOptions() {
    return this.playoffs
      ? this.options()
      : { ...this.options(), seed: this.preview()?.seed ?? null };
  }

  private run<T>(request: Observable<T>, onSuccess: (result: T) => void): void {
    if (this.working()) {
      return;
    }

    this.working.set(true);
    this.error.set(null);
    request.subscribe({
      next: (result) => {
        this.working.set(false);
        onSuccess(result);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.error.set(this.snackbar.failureText(error));
      },
    });
  }
}
