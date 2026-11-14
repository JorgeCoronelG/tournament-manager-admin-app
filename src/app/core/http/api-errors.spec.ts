import { HttpErrorResponse } from "@angular/common/http";
import { backendMessage, failureMessage, fieldErrors } from "./api-errors";

const response = (status: number, body: unknown) =>
  new HttpErrorResponse({ status, error: body });

describe("api-errors", () => {
  const conflict = {
    code: 422,
    error: {
      code: "field_conflict",
      message:
        "La cancha ya está ocupada por Torneo Uno el domingo 3 de enero.",
      tournament_id: 1,
    },
  };

  describe("backendMessage", () => {
    it("reads an `error` that is plain text", () => {
      expect(
        backendMessage(response(422, { code: 422, error: "Código inválido." })),
      ).toBe("Código inválido.");
    });

    it("reads the `message` of an `error` that is an object", () => {
      expect(backendMessage(response(422, conflict))).toBe(
        conflict.error.message,
      );
    });

    it("is null without a text message", () => {
      expect(
        backendMessage(response(422, { error: { code: "x" } })),
      ).toBeNull();
      expect(
        backendMessage(response(422, { error: { message: "" } })),
      ).toBeNull();
      expect(
        backendMessage(response(422, { error: { name: ["Requerido"] } })),
      ).toBeNull();
      expect(backendMessage(response(500, null))).toBeNull();
    });
  });

  describe("fieldErrors", () => {
    it("keeps the errors by field as lists", () => {
      expect(
        fieldErrors(
          response(422, { error: { name: ["Requerido"], age: ["Inválida"] } }),
        ),
      ).toEqual({ name: ["Requerido"], age: ["Inválida"] });
    });

    it("does not treat a conflict as errors by field", () => {
      expect(fieldErrors(response(422, conflict))).toBeNull();
    });
  });

  describe("failureMessage", () => {
    const translate = (key: string) => key;

    it("uses the backend's message for a conflict", () => {
      expect(failureMessage(response(422, conflict), translate)).toBe(
        conflict.error.message,
      );
    });

    it("falls back to the generic one for the status without a message", () => {
      expect(failureMessage(response(422, { error: {} }), translate)).toBe(
        "errors.generic",
      );
      expect(failureMessage(response(500, null), translate)).toBe(
        "errors.server",
      );
    });
  });
});
