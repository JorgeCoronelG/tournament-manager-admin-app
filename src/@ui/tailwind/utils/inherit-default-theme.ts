import type { AppThemeOptions } from "../plugins/themes";
import { DeepPartial } from "../../interfaces/deep-partial.type";
import { mergeDeep } from "../../utils/merge-deep";
import deepClone from "../../utils/deep-clone";

export function inheritDefaultTheme(
  theme: DeepPartial<AppThemeOptions>,
  defaultTheme: AppThemeOptions,
): AppThemeOptions {
  return mergeDeep(deepClone(defaultTheme), theme);
}
