/** Kind the timepicker gives to text that is not a time ("25:00", "ab"): its value is empty, but the field is not */
const TIME_PARSE_ERROR = "matTimepickerParse";

/** The field holds text that could not be read as a time */
export function hasInvalidTime(
  errors: ReadonlyArray<{ kind?: string }>,
): boolean {
  return errors.some(
    (error) => error.kind === TIME_PARSE_ERROR || error.kind === "invalid",
  );
}
