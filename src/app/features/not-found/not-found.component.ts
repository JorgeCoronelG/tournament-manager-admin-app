import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { TranslocoPipe } from "@jsverse/transloco";

@Component({
  selector: "app-not-found",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, RouterLink, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center text-center py-24 px-6">
      <div class="text-8xl font-bold text-primary-600 leading-none">404</div>
      <h1 class="mt-4 mb-2">{{ "notFound.title" | transloco }}</h1>
      <p class="text-secondary mb-6">{{ "notFound.message" | transloco }}</p>
      <a [routerLink]="['/']" color="primary" mat-flat-button>{{
        "notFound.back" | transloco
      }}</a>
    </div>
  `,
})
export class NotFoundComponent {}
