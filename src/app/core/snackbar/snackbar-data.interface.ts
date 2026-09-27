import { SnackbarVariant } from "./snackbar-variant.type";

export interface SnackbarData {
  message: string;
  variant: SnackbarVariant;
  action?: string;
}
