import { HttpErrorResponse } from "@angular/common/http";
import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { RefereeLookup } from "../referee.model";
import { RefereesApi } from "../referees.api";
import { AddRefereeDialogComponent } from "./add-referee-dialog.component";

const lookupResult = (alreadyInLeague = false): RefereeLookup => ({
  user_id: 7,
  first_name: "Ana",
  last_name: "Pérez",
  photo_url: null,
  already_in_league: alreadyInLeague,
});

describe("AddRefereeDialogComponent", () => {
  const create = vi.fn();
  const attach = vi.fn();
  const reload = vi.fn();
  const close = vi.fn();
  const notifyFailure = vi.fn();

  let value: WritableSignal<RefereeLookup | undefined>;
  let failure: WritableSignal<unknown>;
  let lookedUp: () => string;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        {
          provide: RefereesApi,
          useValue: {
            create,
            attach,
            lookup: (code: () => string) => {
              lookedUp = code;

              return {
                value,
                hasValue: () => value() !== undefined,
                error: failure,
                isLoading: signal(false),
                reload,
              };
            },
          },
        },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure },
        },
      ],
    });
    TestBed.overrideComponent(AddRefereeDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(AddRefereeDialogComponent).componentInstance;
  }

  function fillNew(component: AddRefereeDialogComponent) {
    const f = component.newForm;
    f.first_name().value.set("  Ana ");
    f.last_name().value.set("Pérez");
    f.email().value.set("ana@example.com");
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    attach.mockReset().mockReturnValue(of({ id: 7 }));
    reload.mockReset();
    close.mockReset();
    notifyFailure.mockReset();
    value = signal<RefereeLookup | undefined>(undefined);
    failure = signal<unknown>(undefined);
  });

  describe("new referee tab", () => {
    it("does not submit an empty form but accepts no phone", async () => {
      const component = setup();

      await component.saveNew();

      expect(create).not.toHaveBeenCalled();
      const f = component.newForm;
      expect(f.first_name().invalid()).toBe(true);
      expect(f.last_name().invalid()).toBe(true);
      expect(f.email().invalid()).toBe(true);
      expect(f.phone().invalid()).toBe(false);
    });

    it("validates the email and the 10-digit phone", () => {
      const component = setup();
      const f = component.newForm;

      f.email().value.set("nope");
      f.phone().value.set("123");
      expect(f.email().invalid()).toBe(true);
      expect(f.phone().invalid()).toBe(true);

      f.email().value.set("ana@example.com");
      f.phone().value.set("5512345678");
      expect(f.email().invalid()).toBe(false);
      expect(f.phone().invalid()).toBe(false);
    });

    it("creates the referee and closes", async () => {
      const component = setup();
      fillNew(component);

      await component.saveNew();

      expect(create).toHaveBeenCalledWith({
        first_name: "Ana",
        last_name: "Pérez",
        email: "ana@example.com",
        phone: null,
      });
      expect(close).toHaveBeenCalledWith("created");
    });

    it("shows a duplicate email on its field and offers the code tab", async () => {
      create.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                code: 422,
                error: { email: ["El correo ya está registrado."] },
              },
            }),
        ),
      );
      const component = setup();
      fillNew(component);
      expect(component.duplicate()).toBe(false);

      await component.saveNew();

      expect(close).not.toHaveBeenCalled();
      expect(component.errorText(component.newForm.email().errors(), "")).toBe(
        "El correo ya está registrado.",
      );
      expect(component.duplicate()).toBe(true);

      component.goToCode();
      expect(component.tab()).toBe(1);
      expect(component.cameFromDuplicate()).toBe(true);
    });

    it("reports other failures in a snackbar", async () => {
      create.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const component = setup();
      fillNew(component);

      await component.saveNew();

      expect(notifyFailure).toHaveBeenCalled();
      expect(component.duplicate()).toBe(false);
    });
  });

  describe("code tab", () => {
    it("does not search without a code", () => {
      const component = setup();

      component.search();

      expect(lookedUp()).toBe("");
      expect(component.codeForm.user_code().invalid()).toBe(true);
    });

    it("searches the normalized code and shows the referee found", () => {
      const component = setup();
      component.codeForm.user_code().value.set("  abc123 ");

      component.search();
      value.set(lookupResult());

      expect(lookedUp()).toBe("ABC123");
      expect(component.found()?.first_name).toBe("Ana");
      expect(component.lookupError()).toBeNull();
    });

    it("searches again when the code did not change", () => {
      const component = setup();
      component.codeForm.user_code().value.set("ABC123");

      component.search();
      component.search();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("hides the result once the code is edited", () => {
      const component = setup();
      component.codeForm.user_code().value.set("ABC123");
      component.search();
      value.set(lookupResult());

      component.codeForm.user_code().value.set("ABC124");

      expect(component.found()).toBeUndefined();
    });

    it("attaches the referee found and closes", async () => {
      const component = setup();
      component.codeForm.user_code().value.set("abc123");
      component.search();
      value.set(lookupResult());

      await component.attach();

      expect(attach).toHaveBeenCalledWith("ABC123");
      expect(close).toHaveBeenCalledWith("attached");
    });

    it("tells when the referee is already in the league", () => {
      const component = setup();
      component.codeForm.user_code().value.set("ABC123");
      component.search();
      value.set(lookupResult(true));

      expect(component.found()?.already_in_league).toBe(true);
    });

    it("answers a neutral message to a 404, asks to wait on a 429 and has a generic one", () => {
      const component = setup();
      component.codeForm.user_code().value.set("ABC123");
      component.search();

      failure.set(new HttpErrorResponse({ status: 404 }));
      expect(component.lookupError()).toBe("notFound");

      failure.set(new HttpErrorResponse({ status: 429 }));
      expect(component.lookupError()).toBe("tooMany");

      failure.set(new HttpErrorResponse({ status: 500 }));
      expect(component.lookupError()).toBe("generic");
    });
  });
});
