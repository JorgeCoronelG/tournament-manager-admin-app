import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";
import { LogoImageComponent } from "../logo-image/logo-image.component";
import { LOGO_TYPES, LogoError, validateLogo } from "./logo-validation";

let nextId = 0;

/**
 * Picks an image to use as a logo, by dragging it onto the zone or with the
 * button. It only holds the choice: `file` is the new
 * image (already validated) and `removed` says the current one must go; the
 * caller uploads or deletes when it saves.
 */
@Component({
  selector: "app-logo-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LogoImageComponent, MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div
      (dragenter)="dragOver($event, true)"
      (dragleave)="dragOver($event, false)"
      (dragover)="dragOver($event, true)"
      (drop)="drop($event)"
      [class]="
        dragging()
          ? 'border-primary-600 bg-primary-600/5'
          : 'border-gray-500/50'
      "
      class="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed p-3 text-center transition-colors"
    >
      @if (hasImage()) {
        <app-logo-image
          [alt]="alt()"
          [src]="preview()"
          class="w-16 h-16 rounded-full shrink-0"
        />
      } @else {
        <mat-icon
          class="!w-8 !h-8 text-primary-600"
          svgIcon="mat:cloud_upload"
        />
      }
      <p class="m-0 text-xs font-medium">
        {{ "logoPicker.drop" | transloco }}
      </p>
      <label [for]="inputId" class="sr-only">{{
        "logoPicker.label" | transloco
      }}</label>
      <input
        #input
        (change)="pick(input)"
        [accept]="accept"
        [id]="inputId"
        class="sr-only"
        tabindex="-1"
        type="file"
      />
      <div class="flex flex-wrap justify-center gap-1">
        <button
          (click)="input.click()"
          class="!text-xs"
          mat-flat-button
          type="button"
        >
          {{
            (hasImage() ? "logoPicker.change" : "logoPicker.choose") | transloco
          }}
        </button>
        @if (hasImage()) {
          <button (click)="clear()" class="!text-xs" mat-button type="button">
            {{ "logoPicker.remove" | transloco }}
          </button>
        }
      </div>
      @if (error(); as error) {
        <p class="m-0 text-xs text-red-600 dark:text-red-400" role="alert">
          {{ "logoPicker.errors." + error | transloco }}
        </p>
      } @else {
        <p class="m-0 text-xs text-secondary">
          {{ "logoPicker.hint" | transloco }}
        </p>
      }
    </div>
  `,
})
export class LogoPickerComponent {
  /** The logo the record has now (an edit starts with it) */
  readonly currentUrl = input<string | null>(null);
  readonly alt = input("");

  /** The new image chosen, null when there is none */
  readonly file = model<File | null>(null);
  /** The current image was removed (and no new one chosen) */
  readonly removed = model(false);

  protected readonly accept = LOGO_TYPES.join(",");
  protected readonly inputId = `app-logo-picker-${nextId++}`;
  protected readonly error = signal<LogoError | null>(null);
  protected readonly dragging = signal(false);

  private readonly objectUrl = signal<string | null>(null);

  protected readonly preview = computed(
    () => this.objectUrl() ?? (this.removed() ? null : this.currentUrl()),
  );
  protected readonly hasImage = computed(() => this.preview() !== null);

  constructor() {
    // The preview follows the chosen file; the old object URL is released
    effect((onCleanup) => {
      const file = this.file();

      if (!file) {
        this.objectUrl.set(null);

        return;
      }

      const url = URL.createObjectURL(file);
      this.objectUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });

    inject(DestroyRef).onDestroy(() => this.objectUrl.set(null));
  }

  protected pick(input: HTMLInputElement): void {
    const file = input.files?.item(0) ?? null;
    // Allows choosing the same file again after a rejection or a removal
    input.value = "";

    this.take(file);
  }

  protected dragOver(event: DragEvent, over: boolean): void {
    // Without this the browser opens the file instead of dropping it here
    event.preventDefault();

    // Moving over a child of the zone also fires dragleave: not a real exit
    const into = event.relatedTarget;

    if (
      !over &&
      into instanceof Node &&
      (event.currentTarget as Node).contains(into)
    ) {
      return;
    }

    this.dragging.set(over);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.take(event.dataTransfer?.files.item(0) ?? null);
  }

  private take(file: File | null): void {
    if (!file) {
      return;
    }

    const error = validateLogo(file);
    this.error.set(error);

    if (!error) {
      this.file.set(file);
      this.removed.set(false);
    }
  }

  protected clear(): void {
    this.error.set(null);
    this.file.set(null);
    this.removed.set(!!this.currentUrl());
  }
}
