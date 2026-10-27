import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { forkJoin, map, of } from "rxjs";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { RefereesApi } from "../../referees/referees.api";
import { RefereesQuery } from "../../referees/referee.model";
import { formatDate, parseDate } from "../../tournaments/tournament.model";
import { Tournament } from "../../tournaments/tournament.model";
import { AgendaApi } from "../agenda.api";
import {
  AgendaMatch,
  AgendaQuery,
  byField,
  cardBox,
  hourRange,
  MINUTE_HEIGHT,
} from "../agenda.model";
import { Match } from "../match.model";
import {
  ProgramMatchDialogComponent,
  ProgramMatchDialogData,
} from "../program-match-dialog/program-match-dialog.component";
import { slotParts } from "../schedule.model";

const DAY_MS = 86_400_000;

/** Monday of the week of a date */
function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return monday;
}

/** The agenda of the whole league: matches with an hour of every tournament, by day (a column per field) or by week */
@Component({
  selector: "app-agenda-view",
  templateUrl: "./agenda-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class AgendaViewComponent {
  private readonly api = inject(AgendaApi);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  protected readonly league = inject(LeagueContextService);
  protected readonly parseDate = parseDate;
  protected readonly minuteHeight = MINUTE_HEIGHT;

  /** Tournaments of the league, for the filter and to know which can still be edited */
  readonly tournaments = input.required<readonly Tournament[]>();
  /** The tournament picked in the calendar when the agenda was opened */
  readonly initialTournament = input<number | "">("");

  /** A tournament's link was followed: its calendar must open */
  readonly openCalendar = output<number>();

  readonly view = signal<"day" | "week">("day");
  readonly anchor = signal(new Date());

  readonly tournament = signal<number | "">("");
  readonly referee = signal<number | "">("");
  readonly field = signal<number | "">("");
  readonly noReferee = signal(false);

  /** The first request waits for the tournament that was open in the calendar to be set as the filter */
  private readonly seeded = signal(false);
  private readonly seed = effect(() => {
    const initial = this.initialTournament();

    untracked(() => {
      if (!this.seeded()) {
        this.tournament.set(initial);
        this.seeded.set(true);
      }
    });
  });

  private readonly refereesQuery = signal<RefereesQuery>({
    search: "",
    status: "active",
    page: 0,
    pageSize: 100,
    sort: "first_name",
  });
  private readonly refereesList = inject(RefereesApi).list(this.refereesQuery);
  readonly referees = computed(() => this.refereesList.rows() ?? []);

  /** First and last day shown */
  readonly range = computed(() => {
    const anchor = this.anchor();

    if (this.view() === "day") {
      return { from: anchor, to: anchor };
    }

    const monday = mondayOf(anchor);

    return {
      from: monday,
      to: new Date(monday.getTime() + 6 * DAY_MS + 3_600_000),
    };
  });

  private readonly query = computed<AgendaQuery | undefined>(() => {
    if (!this.seeded()) {
      return undefined;
    }

    return {
      from: formatDate(this.range().from),
      to: formatDate(this.range().to),
      tournament: this.tournament(),
      referee: this.referee(),
      field: this.field(),
      noReferee: this.noReferee(),
    };
  });

  readonly resource = this.api.agenda(this.query);
  private readonly agenda = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );

  readonly days = computed(() => this.agenda()?.days ?? []);
  readonly matches = computed(() => this.days().flatMap((day) => day.matches));

  /** The day view's columns: the league's active fields (the filtered one alone), plus one for matches with no field */
  readonly columns = computed(() => {
    const fields = (this.agenda()?.fields ?? []).filter(
      (field) => this.field() === "" || field.id === this.field(),
    );
    const noField = this.matches().some((match) => !match.field);

    return [
      ...fields.map((field) => ({
        id: field.id as number | null,
        name: field.name,
      })),
      ...(noField && this.field() === ""
        ? [{ id: null as number | null, name: "" }]
        : []),
    ];
  });

  readonly hours = computed(() => {
    const { first, last } = hourRange(this.matches());

    return Array.from({ length: last - first }, (_, i) => first + i);
  });

  readonly firstHour = computed(() => this.hours()[0] ?? 8);
  readonly gridHeight = computed(
    () => this.hours().length * 60 * MINUTE_HEIGHT,
  );

  /** The day view's matches by field */
  readonly byColumn = computed(() => byField(this.matches()));

  /** Tournaments that can still have hours assigned */
  private readonly schedulable = computed(() =>
    this.tournaments().filter(
      (tournament) =>
        tournament.status === "in_progress" || tournament.status === "playoffs",
    ),
  );

  /** Matches without an hour of each tournament that is still being scheduled */
  readonly unscheduledResource = rxResource({
    params: () => this.schedulable().map((tournament) => tournament.id),
    stream: ({ params }) =>
      params.length
        ? forkJoin(
            params.map((id) =>
              this.api.unscheduled(id).pipe(map((count) => ({ id, count }))),
            ),
          )
        : of([]),
  });

  readonly unscheduled = computed(() =>
    (this.unscheduledResource.hasValue()
      ? this.unscheduledResource.value()
      : []
    )
      .filter(({ count }) => count > 0)
      .map(({ id, count }) => ({
        id,
        count,
        name:
          this.tournaments().find((tournament) => tournament.id === id)?.name ??
          "",
      })),
  );

  /** "Sáb 07/11" or "07/11 - 13/11" */
  readonly rangeLabel = computed(() => {
    const { from, to } = this.range();
    const text = (date: Date) =>
      `${this.transloco
        .translate(`matches.config.weekdays.${((date.getDay() + 6) % 7) + 1}`)
        .slice(0, 3)} ${String(date.getDate()).padStart(2, "0")}/${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}`;

    return this.view() === "day" ? text(from) : `${text(from)} - ${text(to)}`;
  });

  step(direction: -1 | 1): void {
    const days = this.view() === "day" ? 1 : 7;

    this.anchor.update((date) => {
      const next = new Date(date);

      next.setDate(next.getDate() + direction * days);

      return next;
    });
  }

  today(): void {
    this.anchor.set(new Date());
  }

  setAnchor(date: Date | null): void {
    if (date) {
      this.anchor.set(date);
    }
  }

  /** Top and height of a card, in pixels */
  box(match: AgendaMatch) {
    return cardBox(match, this.firstHour());
  }

  columnMatches(id: number | null): AgendaMatch[] {
    return this.byColumn().get(id) ?? [];
  }

  /** "8:00 a.m." */
  time(match: AgendaMatch): string {
    return slotParts(match.match_datetime).time;
  }

  hourLabel(hour: number): string {
    return `${hour % 12 || 12} ${hour < 12 ? "a.m." : "p.m."}`;
  }

  weekdayName(date: string): string {
    const iso = ((parseDate(date).getDay() + 6) % 7) + 1;

    return this.transloco.translate(`matches.config.weekdays.${iso}`);
  }

  /** Only a match not played, of a tournament that is still being scheduled, can be moved */
  canProgram(match: AgendaMatch): boolean {
    return (
      match.status === "scheduled" &&
      this.schedulable().some(
        (tournament) => tournament.id === match.tournament.id,
      )
    );
  }

  /** Opens the dialog to move the match, change its referee, swap it or take its hour off */
  program(match: AgendaMatch): void {
    if (!this.canProgram(match)) {
      return;
    }

    this.dialog
      .open<ProgramMatchDialogComponent, ProgramMatchDialogData, boolean>(
        ProgramMatchDialogComponent,
        {
          data: {
            tournamentId: match.tournament.id,
            match: this.toMatch(match),
            candidates: this.matches()
              .filter(
                (other) =>
                  other.tournament.id === match.tournament.id &&
                  other.status === "scheduled",
              )
              .map((other) => this.toMatch(other)),
          },
          width: "720px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.resource.reload();
          this.unscheduledResource.reload();
        }
      });
  }

  private toMatch(item: AgendaMatch): Match {
    const side = (name: string | null) =>
      name === null
        ? null
        : { registration_id: 0, team_id: 0, team_name: name, logo_url: null };

    return {
      id: item.id,
      group_id: 0,
      group_name: item.group,
      matchday: 0,
      round_number: 1,
      round_label: item.round_label,
      status: item.status,
      match_datetime: item.match_datetime,
      field: item.field,
      referee: item.referee,
      schedule_locked: item.schedule_locked,
      home: side(item.home_team),
      away: side(item.away_team),
      home_score: null,
      away_score: null,
    };
  }
}
