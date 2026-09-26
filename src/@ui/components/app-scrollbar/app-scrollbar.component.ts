import {
  AfterContentInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  input,
} from "@angular/core";
import SimpleBar from "simplebar";

type SimpleBarOptions = ConstructorParameters<typeof SimpleBar>[1];

@Component({
  selector: "app-scrollbar",
  template: ` <ng-content />`,
  styleUrls: ["./app-scrollbar.component.scss"],
  host: {
    class: "app-scrollbar",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppScrollbarComponent implements AfterContentInit, OnDestroy {
  private _element = inject(ElementRef);
  private zone = inject(NgZone);

  readonly options = input<SimpleBarOptions>();

  scrollbarRef?: SimpleBar;

  ngAfterContentInit() {
    this.zone.runOutsideAngular(() => {
      this.scrollbarRef = new SimpleBar(
        this._element.nativeElement,
        this.options(),
      );
    });
  }

  ngOnDestroy(): void {
    /**
     * Exists, but not typed in the type definition
     * https://github.com/Grsmto/simplebar/blob/master/packages/simplebar/src/simplebar.js#L903
     */
    this.scrollbarRef?.unMount();
  }
}
