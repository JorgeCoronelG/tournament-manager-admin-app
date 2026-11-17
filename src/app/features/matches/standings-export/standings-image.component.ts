import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { StandingsImageData } from "./standings-image.model";

/** A grey shield, for a team without logo or whose logo did not load */
export const SHIELD_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6L12 3Z"/></svg>',
  );

/**
 * The picture of a standings table that is exported: fixed width and always the light
 * look, whatever the app's theme is, so it uses no theme colours nor `dark:` classes.
 * It is never shown on screen: the export service mounts it out of view and removes it.
 */
@Component({
  selector: "app-standings-image",
  templateUrl: "./standings-image.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslocoPipe],
  host: { class: "block w-[1080px] bg-white text-gray-900" },
})
export class StandingsImageComponent {
  private readonly transloco = inject(TranslocoService);

  readonly data = input.required<StandingsImageData>();

  protected readonly shield = SHIELD_IMAGE;

  protected readonly columns = [
    ["played", "played"],
    ["won", "won"],
    ["drawn", "drawn"],
    ["lost", "lost"],
    ["goals_for", "goalsFor"],
    ["goals_against", "goalsAgainst"],
    ["goal_difference", "goalDifference"],
    ["points", "points"],
  ] as const;

  /** "Fase regular · Grupo A · Jornada 7" */
  protected readonly subtitle = computed(() => {
    const { groupName, matchday } = this.data();

    return [
      this.transloco.translate("matches.standings.export.phase"),
      groupName,
      matchday > 0
        ? this.transloco.translate("matches.standings.export.matchday", {
            n: matchday,
          })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  });
}
