import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

/**
 * A list that scrolls inside its own box (`maxHeight`) and shows a soft fade at
 * the bottom while there is more below, so it is clear there is more to scroll.
 * The fade only shows when the content really overflows and goes away at the
 * end. Put the list inside; the caller sets spacing with classes on the host.
 */
@Component({
  selector: "app-scroll-fade",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "relative block" },
  template: `
    <div
      #scroller
      (scroll)="update()"
      [attr.tabindex]="overflows() ? 0 : null"
      [class]="
        maxHeight() +
        (thin() ? ' app-scroll-thin' : '') +
        (mask() && overflows() && !atEnd() ? maskClass : '')
      "
      class="overflow-y-auto"
    >
      <div #content><ng-content /></div>
    </div>
    @if (!mask() && overflows() && !atEnd()) {
      <div
        [class]="fadeHeight()"
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,var(--app-background-card),transparent)]"
      ></div>
    }
  `,
})
export class ScrollFadeComponent {
  /** Tailwind max-height class where the list starts to scroll, in full (`max-h-60`) */
  readonly maxHeight = input("max-h-60");
  /** Tailwind height class of the fade, written in full (`h-8`) so Tailwind finds it */
  readonly fadeHeight = input("h-10");
  /**
   * Fades the content itself to transparent instead of painting the card color
   * over it: for a list on a background that is not the card's (a colored box)
   */
  readonly mask = input(false);

  /** A scrollbar half as wide (`app-scroll-thin`) so it does not take over the form */
  readonly thin = input(false);

  /** Written whole here so Tailwind finds it */
  protected readonly maskClass =
    " [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]";

  private readonly scroller =
    viewChild.required<ElementRef<HTMLElement>>("scroller");
  private readonly content =
    viewChild.required<ElementRef<HTMLElement>>("content");

  /** The content is taller than the box */
  protected readonly overflows = signal(false);
  /** The list is scrolled to its last element */
  protected readonly atEnd = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // The box or its content changes size (another search, a window resize)
      const observer = new ResizeObserver(() => this.update());

      observer.observe(this.scroller().nativeElement);
      observer.observe(this.content().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
      this.update();
    });
  }

  protected update(): void {
    const list = this.scroller().nativeElement;

    this.overflows.set(list.scrollHeight > list.clientHeight + 1);
    this.atEnd.set(list.scrollTop + list.clientHeight >= list.scrollHeight - 2);
  }
}
