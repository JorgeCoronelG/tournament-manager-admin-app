import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";
import { SHIELD_IMAGE } from "../standings-export/standings-image.component";
import { JornadaImageData } from "./jornada-image.model";

/**
 * The picture of a matchday that is exported: fixed width and always the light look,
 * like the standings one. The export service mounts it out of view and removes it.
 */
@Component({
  selector: "app-jornada-image",
  templateUrl: "./jornada-image.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslocoPipe],
  host: { class: "block w-[1080px] bg-white text-gray-900" },
})
export class JornadaImageComponent {
  readonly data = input.required<JornadaImageData>();

  protected readonly shield = SHIELD_IMAGE;
}
