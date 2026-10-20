import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, Subject, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Team } from "../team.model";
import { TeamsApi } from "../teams.api";
import { TeamFormDialogComponent } from "./team-form-dialog.component";

const saved: Team = {
  id: 1,
  name: "Tigres",
  logo_url: null,
  status: "active",
  manager: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const existing: Team = { ...saved, id: 9, logo_url: "http://x/logo.png" };

const png = () => new File(["x"], "logo.png", { type: "image/png" });

describe("TeamFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const uploadLogo = vi.fn();
  const removeLogo = vi.fn();
  const close = vi.fn();
  const notifyFailure = vi.fn();

  function setup(data: Team | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        {
          provide: TeamsApi,
          useValue: { create, update, uploadLogo, removeLogo },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: SnackbarService,
          useValue: { error: vi.fn(), notifyFailure },
        },
      ],
    });
    TestBed.overrideComponent(TeamFormDialogComponent, {
      set: { template: "" },
    });

    return TestBed.createComponent(TeamFormDialogComponent).componentInstance;
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of(saved));
    update.mockReset().mockReturnValue(of(existing));
    uploadLogo.mockReset().mockReturnValue(of({ ...saved, logo_url: "u" }));
    removeLogo.mockReset().mockReturnValue(of(undefined));
    close.mockReset();
    notifyFailure.mockReset();
  });

  it("requires the name and accepts up to 150 characters", async () => {
    const component = setup();

    await component.save();
    expect(create).not.toHaveBeenCalled();
    expect(component.errorText(component.teamForm.name().errors())).toBe(
      "Este campo es obligatorio",
    );

    component.teamForm.name().value.set("a".repeat(150));
    expect(component.teamForm.name().invalid()).toBe(false);
    component.teamForm.name().value.set("a".repeat(151));
    expect(component.errorText(component.teamForm.name().errors())).toContain(
      "150",
    );
  });

  describe("delegate options", () => {
    it("creates without delegate by default", async () => {
      const component = setup();
      component.teamForm.name().value.set("  Tigres ");

      await component.save();

      expect(create).toHaveBeenCalledWith({ name: "Tigres" });
      expect(close).toHaveBeenCalledWith({ team: saved, logoFailed: false });
    });

    it("sends a new delegate's trimmed data, with a null phone when empty", async () => {
      const component = setup();
      const f = component.teamForm;
      f.name().value.set("Tigres");
      f.mode().value.set("new");
      f.first_name().value.set("  Ana ");
      f.last_name().value.set("Pérez");
      f.email().value.set("ana@example.com");

      await component.save();

      expect(create).toHaveBeenCalledWith({
        name: "Tigres",
        manager: {
          first_name: "Ana",
          last_name: "Pérez",
          email: "ana@example.com",
          phone: null,
        },
      });
    });

    it("validates the new delegate's fields only in that option", async () => {
      const component = setup();
      const f = component.teamForm;
      f.name().value.set("Tigres");
      f.mode().value.set("new");

      await component.save();
      expect(create).not.toHaveBeenCalled();
      expect(f.first_name().invalid()).toBe(true);
      expect(f.email().invalid()).toBe(true);

      f.first_name().value.set("Ana");
      f.last_name().value.set("Pérez");
      f.email().value.set("no-es-correo");
      f.phone().value.set("123");
      expect(f.email().invalid()).toBe(true);
      expect(f.phone().invalid()).toBe(true);

      // Back to "no delegate": those fields no longer count
      f.mode().value.set("none");
      expect(f.email().invalid()).toBe(false);
      expect(f.phone().invalid()).toBe(false);
    });

    it("sends the code of an existing delegate, normalized", async () => {
      const component = setup();
      const f = component.teamForm;
      f.name().value.set("Tigres");
      f.mode().value.set("code");

      await component.save();
      expect(create).not.toHaveBeenCalled();
      expect(f.user_code().invalid()).toBe(true);

      f.user_code().value.set(" ab12 ");
      await component.save();

      expect(create).toHaveBeenCalledWith({
        name: "Tigres",
        manager: { user_code: "AB12" },
      });
    });

    it("needs the delegate found before saving with a code", () => {
      const component = setup();
      component.teamForm.mode().value.set("code");
      expect(component.canSave()).toBe(false);

      component.found.set({
        user_id: 7,
        first_name: "Ana",
        last_name: "Pérez",
        photo_url: null,
      });
      expect(component.canSave()).toBe(true);
    });
  });

  describe("server errors", () => {
    const unprocessable = (errors: Record<string, string[]>) =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 422, error: errors },
          }),
      );

    it("maps them to the name and the delegate's fields and keeps the dialog open", async () => {
      create.mockReturnValue(
        unprocessable({
          name: ["El equipo ya existe en la liga."],
          email: ["El correo ya está registrado."],
        }),
      );
      const component = setup();
      const f = component.teamForm;
      f.name().value.set("Tigres");
      f.mode().value.set("new");
      f.first_name().value.set("Ana");
      f.last_name().value.set("Pérez");
      f.email().value.set("ana@example.com");

      await component.save();

      expect(close).not.toHaveBeenCalled();
      expect(component.errorText(f.name().errors())).toBe(
        "El equipo ya existe en la liga.",
      );
      expect(f.email().errors()[0]?.kind).toBe("server");
      expect(f.email().errors()[0]?.message).toBe(
        "El correo ya está registrado.",
      );
      expect(f().submitting()).toBe(false);
    });

    it("shows a duplicate name message from the server on the name field", async () => {
      const message = "Este delegado ya tiene un equipo con ese nombre.";
      create.mockReturnValue(unprocessable({ name: [message] }));
      const component = setup();
      component.teamForm.name().value.set("Tigres");

      await component.save();

      expect(component.errorText(component.teamForm.name().errors())).toBe(
        message,
      );
      expect(close).not.toHaveBeenCalled();
    });

    it("lets the user save again after changing the delegate, without retyping the name", async () => {
      create.mockReturnValueOnce(
        unprocessable({
          name: ["Ya existe un equipo sin delegado con ese nombre."],
        }),
      );
      const component = setup();
      const f = component.teamForm;
      f.name().value.set("Tigres");

      await component.save();
      expect(f.name().invalid()).toBe(true);

      // Another delegate makes the same name valid again
      f.mode().value.set("new");
      f.first_name().value.set("Ana");
      f.last_name().value.set("Pérez");
      f.email().value.set("ana@example.com");
      expect(f.name().invalid()).toBe(false);

      await component.save();

      expect(create).toHaveBeenCalledTimes(2);
      expect(close).toHaveBeenCalled();
    });

    it("reports other failures in a snackbar", async () => {
      update.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const component = setup(existing);

      await component.save();

      expect(notifyFailure).toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    });
  });

  it("does not send twice while saving", async () => {
    const pending = new Subject<Team>();
    create.mockReturnValue(pending);
    const component = setup();
    component.teamForm.name().value.set("Tigres");

    const first = component.save();
    expect(component.teamForm().submitting()).toBe(true);
    expect(component.canSave()).toBe(false);
    void component.save();
    expect(create).toHaveBeenCalledTimes(1);

    pending.next(saved);
    pending.complete();
    await first;

    expect(component.teamForm().submitting()).toBe(false);
  });

  describe("logo", () => {
    it("uploads it after saving the team and closes with the updated team", async () => {
      const component = setup();
      component.teamForm.name().value.set("Tigres");
      const file = png();
      component.logoFile.set(file);

      await component.save();

      expect(uploadLogo).toHaveBeenCalledWith(1, file);
      expect(close).toHaveBeenCalledWith({
        team: { ...saved, logo_url: "u" },
        logoFailed: false,
      });
    });

    it("does not upload when the team could not be saved", async () => {
      create.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const component = setup();
      component.teamForm.name().value.set("Tigres");
      component.logoFile.set(png());

      await component.save();

      expect(uploadLogo).not.toHaveBeenCalled();
    });

    it("closes saying the logo failed when only the upload fails", async () => {
      uploadLogo.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 413 })),
      );
      const component = setup();
      component.teamForm.name().value.set("Tigres");
      component.logoFile.set(png());

      await component.save();

      expect(close).toHaveBeenCalledWith({ team: saved, logoFailed: true });
    });

    it("removes the current logo of an existing team", async () => {
      const component = setup(existing);
      component.logoRemoved.set(true);

      await component.save();

      expect(update).toHaveBeenCalledWith(9, { name: "Tigres" });
      expect(removeLogo).toHaveBeenCalledWith(9);
      expect(close).toHaveBeenCalledWith({
        team: existing,
        logoFailed: false,
      });
    });

    it("touches no logo when none was chosen", async () => {
      const component = setup(existing);

      await component.save();

      expect(uploadLogo).not.toHaveBeenCalled();
      expect(removeLogo).not.toHaveBeenCalled();
    });
  });
});
