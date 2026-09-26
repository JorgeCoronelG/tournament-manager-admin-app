import { TranslocoPipe } from "@jsverse/transloco";
import { Component, ChangeDetectionStrategy, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";

@Component({
  selector: "app-config-panel-toggle",
  templateUrl: "./config-panel-toggle.component.html",
  styleUrls: ["./config-panel-toggle.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, MatButtonModule, MatIconModule],
})
export class ConfigPanelToggleComponent {
  readonly openConfig = output();
}
