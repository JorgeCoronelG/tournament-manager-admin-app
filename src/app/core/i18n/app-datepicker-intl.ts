import { Injectable, inject } from "@angular/core";
import { MatDatepickerIntl } from "@angular/material/datepicker";
import { TranslocoService } from "@jsverse/transloco";

/** Translates the `mat-datepicker` labels, which Angular Material ships only in English. */
@Injectable()
export class AppDatepickerIntl extends MatDatepickerIntl {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    super();

    this.translateLabels();
    this.transloco.langChanges$.subscribe(() => this.translateLabels());
  }

  private translateLabels(): void {
    const t = (key: string) => this.transloco.translate(`datepicker.${key}`);

    this.calendarLabel = t("calendar");
    this.openCalendarLabel = t("open");
    this.closeCalendarLabel = t("close");
    this.prevMonthLabel = t("prevMonth");
    this.nextMonthLabel = t("nextMonth");
    this.prevYearLabel = t("prevYear");
    this.nextYearLabel = t("nextYear");
    this.prevMultiYearLabel = t("prevMultiYear");
    this.nextMultiYearLabel = t("nextMultiYear");
    this.switchToMonthViewLabel = t("switchToMonth");
    this.switchToMultiYearViewLabel = t("switchToYear");
    this.changes.next();
  }
}
