import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";
import { ResultsImageData } from "../jornada-image/jornada-image.model";
import { SHIELD_IMAGE } from "../standings-export/standings-image.component";

/**
 * The picture of a matchday's results that is exported: fixed width and always the
 * light look. The export service mounts it out of view and removes it.
 */
@Component({
  selector: "app-results-image",
  templateUrl: "./results-image.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslocoPipe],
  host: { class: "block w-[1080px] bg-white text-gray-900" },
})
export class ResultsImageComponent {
  readonly data = input.required<ResultsImageData>();

  protected readonly shield = SHIELD_IMAGE;

  /** Soft accent background for the winner */
  protected readonly winnerClass = "rounded-lg bg-primary-100 text-primary-900";
}
