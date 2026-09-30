import { Injectable, inject } from "@angular/core";
import { MatPaginatorIntl } from "@angular/material/paginator";
import { TranslocoService } from "@jsverse/transloco";
import { Subject } from "rxjs";

/** Translates the `mat-paginator` labels, which Angular Material ships only in English. */
@Injectable()
export class AppPaginatorIntl extends MatPaginatorIntl {
  private readonly transloco = inject(TranslocoService);

  override changes = new Subject<void>();

  constructor() {
    super();

    this.translateLabels();
    this.transloco.langChanges$.subscribe(() => this.translateLabels());
  }

  override getRangeLabel = (
    page: number,
    pageSize: number,
    length: number,
  ): string => {
    if (length === 0 || pageSize === 0) {
      return this.transloco.translate("paginator.rangeEmpty", { length });
    }

    const startIndex = page * pageSize;
    const endIndex =
      startIndex < length
        ? Math.min(startIndex + pageSize, length)
        : startIndex + pageSize;

    return this.transloco.translate("paginator.range", {
      startIndex: startIndex + 1,
      endIndex,
      length,
    });
  };

  private translateLabels(): void {
    this.itemsPerPageLabel = this.transloco.translate("paginator.itemsPerPage");
    this.nextPageLabel = this.transloco.translate("paginator.nextPage");
    this.previousPageLabel = this.transloco.translate("paginator.previousPage");
    this.firstPageLabel = this.transloco.translate("paginator.firstPage");
    this.lastPageLabel = this.transloco.translate("paginator.lastPage");
    this.changes.next();
  }
}
