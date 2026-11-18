import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";
import { ScheduleReadonlyComponent } from "../../matches/schedule-readonly/schedule-readonly.component";

/** The Calendar tab of a finished tournament: its matchdays, read only */
@Component({
  selector: "app-tournament-history-calendar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleReadonlyComponent],
  template: `
    @if (id(); as tournamentId) {
      <app-schedule-readonly [tournamentId]="tournamentId" />
    }
  `,
})
export class TournamentHistoryCalendarComponent {
  // The tournament's id is in the detail route that holds this tab
  protected readonly id = toSignal(
    inject(ActivatedRoute).parent!.paramMap.pipe(
      map((params) => Number(params.get("id")) || undefined),
    ),
    { initialValue: undefined },
  );
}
