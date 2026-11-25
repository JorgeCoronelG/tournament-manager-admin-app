import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  linkedSignal,
  input,
  output,
  signal,
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
import { injectIsMobile } from "../../../shared/responsive/is-mobile";
import { FiltersPanelComponent } from "../../../shared/mobile-filters/filters-panel.component";
import { FiltersToggleComponent } from "../../../shared/mobile-filters/filters-toggle.component";
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
    FiltersPanelComponent,
    FiltersToggleComponent,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly league = inject(LeagueContextService);
  protected readonly isMobile = injectIsMobile();
  protected readonly parseDate = parseDate;
  protected readonly minuteHeight = MINUTE_HEIGHT;

  /** Tournaments of the league, for the filter and to know which can still be edited */
  readonly tournaments = input.required<readonly Tournament[]>();
  /** A tournament's link was followed: its calendar must open */
  readonly openCalendar = output<number>();

  readonly view = signal<"day" | "week">("day");
  readonly anchor = signal(new Date());

  /** The league the filters belong to: changing it empties them, since their options are the league's */
  private readonly leagueId = computed(() => this.league.activeLeague()?.id);

  readonly tournament = linkedSignal<number | undefined, number | "">({
    source: this.leagueId,
    computation: () => "",
  });
  readonly referee = linkedSignal<number | undefined, number | "">({
    source: this.leagueId,
    computation: () => "",
  });
  readonly field = linkedSignal<number | undefined, number | "">({
    source: this.leagueId,
    computation: () => "",
  });
  readonly noReferee = signal(false);

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

  private readonly query = computed<AgendaQuery>(() => {
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

  /** Phones: the filters fold into a panel */
  readonly filtersOpen = signal(false);

  /** Filters in use (each one counts, "no referee" included) */
  readonly activeFilters = computed(
    () =>
      [
        this.tournament() !== "",
        this.referee() !== "",
        this.field() !== "",
        this.noReferee(),
      ].filter(Boolean).length,
  );

  clearFilters(): void {
    this.tournament.set("");
    this.referee.set("");
    this.field.set("");
    this.noReferee.set(false);
  }

  /** Phones: a list of days (one in the day view, up to seven in the week), each with its matches by hour and then by field */
  readonly mobileDays = computed(() => {
    const byDate = new Map<string, AgendaMatch[]>();

    for (const match of this.matches()) {
      const date = match.match_datetime.slice(0, 10);

      byDate.set(date, [...(byDate.get(date) ?? []), match]);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, matches]) => ({
        date,
        matches: [...matches].sort(
          (a, b) =>
            a.match_datetime.localeCompare(b.match_datetime) ||
            (a.field?.name ?? "\uffff").localeCompare(
              b.field?.name ?? "\uffff",
            ),
        ),
      }));
  });

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

  /** "Domingo 15 de noviembre", or "Lunes 9 de noviembre - Domingo 15 de noviembre" for a week */
  readonly rangeLabel = computed(() => {
    const { from, to } = this.range();
    const text = (date: Date) =>
      `${this.transloco.translate(
        `matches.config.weekdays.${((date.getDay() + 6) % 7) + 1}`,
      )} ${date.getDate()} de ${date.toLocaleDateString("es", { month: "long" })}`;

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
  /** The match was played and the backend sent its score */
  hasScore(match: AgendaMatch): boolean {
    return (
      match.status === "played" &&
      typeof match.home_score === "number" &&
      typeof match.away_score === "number"
    );
  }

  /**
   * Bold for the winner and gray for the loser; both plain when there is none:
   * a draw, or the first leg of a two-leg tie (the tie is decided in the second)
   */
  resultClass(match: AgendaMatch, side: "home" | "away"): string {
    const plain = "font-medium";

    if (!this.hasScore(match) || match.leg === 1) {
      return plain;
    }

    let home: number | null | undefined = match.home_score;
    let away: number | null | undefined = match.away_score;

    if (match.leg === 2) {
      // The tie goes by the global score
      home = match.global_home;
      away = match.global_away;
    }

    if (this.hasShootout(match)) {
      home = match.home_penalties;
      away = match.away_penalties;
    }

    if (typeof home !== "number" || typeof away !== "number" || home === away) {
      return plain;
    }

    const won = side === "home" ? home > away : away > home;

    return won ? "font-bold" : "font-medium text-gray-500 dark:text-gray-400";
  }

  /** The goals: in bold on a draw and in a two-leg tie, where one leg alone does not decide */
  scoreClass(match: AgendaMatch, side: "home" | "away"): string {
    return match.leg || match.home_score === match.away_score
      ? "font-bold"
      : this.resultClass(
          { ...match, home_penalties: null, away_penalties: null },
          side,
        );
  }

  /** A played second leg, with both legs added up */
  hasGlobal(match: AgendaMatch): boolean {
    return (
      typeof match.global_home === "number" &&
      typeof match.global_away === "number"
    );
  }

  /** The match was decided by a shootout */
  hasShootout(match: AgendaMatch): boolean {
    return (
      typeof match.home_penalties === "number" &&
      typeof match.away_penalties === "number"
    );
  }

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

    const scroller = this.host.nativeElement.closest<HTMLElement>(
      "mat-sidenav-content",
    );
    const top = scroller?.scrollTop ?? 0;
    const keepScroll = () =>
      requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop = top;
        }
      });

    const ref = this.dialog.open<
      ProgramMatchDialogComponent,
      ProgramMatchDialogData,
      boolean
    >(ProgramMatchDialogComponent, {
      autoFocus: "dialog",
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
    });

    // The page keeps its place when the dialog opens and closes, and after the data is asked again
    ref.afterOpened().subscribe(keepScroll);
    ref.afterClosed().subscribe((changed) => {
      keepScroll();

      if (changed) {
        this.resource.reload();
        this.unscheduledResource.reload();
        setTimeout(keepScroll, 400);
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
