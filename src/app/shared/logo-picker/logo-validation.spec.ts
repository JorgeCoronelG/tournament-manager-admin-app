import { LOGO_MAX_BYTES, validateLogo } from "./logo-validation";

describe("validateLogo", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(validateLogo({ type, size: 1000 })).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf", ""])(
    "rejects the type %j",
    (type) => {
      expect(validateLogo({ type, size: 1000 })).toBe("type");
    },
  );

  it("accepts exactly 2 MB and rejects anything over it", () => {
    expect(
      validateLogo({ type: "image/png", size: LOGO_MAX_BYTES }),
    ).toBeNull();
    expect(validateLogo({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toBe(
      "size",
    );
  });

  it("reports the type first when both fail", () => {
    expect(validateLogo({ type: "image/gif", size: LOGO_MAX_BYTES + 1 })).toBe(
      "type",
    );
  });
});
