import { Pipe, PipeTransform } from "@angular/core";
import { DateTime } from "luxon";

@Pipe({
  name: "appDateFormatRelative",
})
export class AppDateFormatRelativePipe implements PipeTransform {
  transform(
    value: DateTime | null | undefined | string,
  ): string | null | undefined {
    if (!value) {
      return;
    }

    if (!(value instanceof DateTime)) {
      value = DateTime.fromISO(value);
    }

    return value.toRelative();
  }
}
