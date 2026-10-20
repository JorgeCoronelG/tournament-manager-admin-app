export const LOGO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Why a file cannot be used as a logo, or null when it can */
export type LogoError = "type" | "size";

/** Checked in the browser before uploading: JPG, PNG or WebP of up to 2 MB */
export function validateLogo(
  file: Pick<File, "type" | "size">,
): LogoError | null {
  if (!LOGO_TYPES.includes(file.type)) {
    return "type";
  }

  return file.size > LOGO_MAX_BYTES ? "size" : null;
}
