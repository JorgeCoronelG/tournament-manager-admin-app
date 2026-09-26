import { TranslocoPipe } from "@jsverse/transloco";
import {
  Component,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
  OnDestroy,
  effect,
  signal,
  viewChild,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import { form, FormField } from "@angular/forms/signals";
import { SearchService } from "./search.service";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";

@Component({
  selector: "app-search",
  templateUrl: "./search.component.html",
  styleUrls: ["./search.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, MatButtonModule, MatIconModule, FormField],
})
export class SearchComponent implements OnDestroy {
  private layoutService = inject(AppLayoutService);
  private searchService = inject(SearchService);

  readonly show = this.layoutService.searchOpen;

  private readonly model = signal({ query: "" });
  readonly searchForm = form(this.model);

  readonly input =
    viewChild.required<ElementRef<HTMLInputElement>>("searchInput");

  constructor() {
    this.searchService.isOpen.set(true);

    effect(() => this.searchService.value.set(this.searchForm.query().value()));

    effect(() => {
      if (this.show()) {
        this.input().nativeElement.focus();
      }
    });
  }

  close() {
    this.reset();
    this.layoutService.closeSearch();
  }

  search() {
    this.searchService.submitSubject.next(this.searchForm.query().value());
    this.close();
  }

  ngOnDestroy(): void {
    this.close();
  }

  private reset() {
    this.model.set({ query: "" });
    this.searchService.isOpen.set(false);
  }
}
