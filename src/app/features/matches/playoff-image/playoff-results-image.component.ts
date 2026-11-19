import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";
import { SHIELD_IMAGE } from "../standings-export/standings-image.component";
import { PlayoffResultsImageData } from "./playoff-image.model";

/**
 * The picture of a liguilla round's results that is exported: fixed width and always
 * the light look. The export service mounts it out of view and removes it.
 */
@Component({
  selector: "app-playoff-results-image",
  templateUrl: "./playoff-results-image.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, NgTemplateOutlet, TranslocoPipe],
  host: { class: "block w-[1080px] bg-white text-gray-900" },
})
export class PlayoffResultsImageComponent {
  readonly data = input.required<PlayoffResultsImageData>();

  protected readonly shield = SHIELD_IMAGE;

  /** Soft accent background for the winner */
  protected readonly winnerClass = "rounded-lg bg-indigo-100 text-indigo-900";
}
