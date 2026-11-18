import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { GroupSchedule, Match, byRound, matchCount } from "../match.model";
import { MatchesApi } from "../matches.api";
import { datesRange, slotLabel } from "../schedule.model";

/**
 * The calendar by matchday of a tournament, read only: the same cards as the Calendar
 * page without the picker, the scheduling actions nor the result capture.
 */
@Component({
  selector: "app-schedule-readonly",
  templateUrl: "./schedule-readonly.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LogoImageComponent,
    MatButtonModule,
    MatExpansionModule,
    MatTabsModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class ScheduleReadonlyComponent {
  private readonly transloco = inject(TranslocoService);

  readonly tournamentId = input.required<number>();

  protected readonly resource = inject(MatchesApi).schedule(this.tournamentId);

  protected readonly groups = computed(() =>
    this.resource.hasValue() ? this.resource.value().groups : [],
  );
  protected readonly total = computed(() =>
    this.groups().reduce((sum, group) => sum + matchCount(group), 0),
  );

  protected readonly selectedTab = signal(0);

  /** The group whose count is shown: the open tab (the only group when there is one) */
  protected readonly currentGroup = computed(
    () => this.groups()[this.selectedTab()] ?? this.groups()[0],
  );

  protected matchesOf(group: GroupSchedule): number {
    return matchCount(group);
  }

  protected roundsOf(group: GroupSchedule) {
    return byRound(group.matchdays);
  }

  protected rangeOf(matches: Match[]): string | null {
    return datesRange(matches);
  }

  /** "Sáb 07/11 · 8:00 a.m. · Cancha 1" */
  protected slotText(match: Match): string {
    return slotLabel(match.match_datetime ?? "", match.field?.name, (weekday) =>
      this.transloco.translate(`matches.config.weekdays.${weekday}`),
    );
  }

  /** The winner in bold and the loser faded; in a draw both look the same */
  protected nameClass(match: Match, side: "home" | "away"): string {
    const { home_score: home, away_score: away } = match;

    if (
      match.status !== "played" ||
      home == null ||
      away == null ||
      home === away
    ) {
      return "font-normal";
    }

    const won = side === "home" ? home > away : away > home;

    return won ? "font-bold" : "font-normal text-gray-500 dark:text-gray-400";
  }
}
