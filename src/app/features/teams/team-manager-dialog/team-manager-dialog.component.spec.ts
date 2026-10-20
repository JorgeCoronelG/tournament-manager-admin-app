import { HttpErrorResponse } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { Team } from "../team.model";
import { TeamsApi } from "../teams.api";
import { TeamManagerDialogComponent } from "./team-manager-dialog.component";

const team: Team = {
  id: 4,
  name: "Halcones",
  logo_url: null,
  status: "active",
  manager: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("TeamManagerDialogComponent", () => {
  const setManager = vi.fn();
  const close = vi.fn();
  const error = vi.fn();
  const notifyFailure = vi.fn();

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        { provide: TeamsApi, useValue: { setManager } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: team },
        {
          provide: SnackbarService,
          useValue: {
            error,
            notifyFailure,
            failureText: (e: HttpErrorResponse) =>
              (e.error as { error?: string }).error ?? "generic",
          },
        },
      ],
    });
    TestBed.overrideComponent(TeamManagerDialogComponent, {
      set: { template: "" },
    });

    const component = TestBed.createComponent(
      TeamManagerDialogComponent,
    ).componentInstance;
    const f = component.managerForm;
    f.first_name().value.set("Ana");
    f.last_name().value.set("Pérez");
    f.email().value.set("ana@example.com");

    return component;
  }

  beforeEach(() => {
    for (const fn of [setManager, close, error, notifyFailure]) {
      fn.mockReset();
    }
  });

  it("closes with the updated team", async () => {
    const updated = { ...team, name: "Halcones" };
    setManager.mockReturnValue(of(updated));
    const component = setup();

    await component.save();

    expect(close).toHaveBeenCalledWith(updated);
    expect(component.serverError()).toBeNull();
  });

  it("shows the server's duplicate message in the dialog, without closing or using the snackbar", async () => {
    setManager.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 422,
              error: "Este delegado ya tiene un equipo con ese nombre.",
            },
          }),
      ),
    );
    const component = setup();

    await component.save();

    expect(component.serverError()).toBe(
      "Este delegado ya tiene un equipo con ese nombre.",
    );
    expect(close).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(notifyFailure).not.toHaveBeenCalled();
  });

  it("clears the message when it tries again", async () => {
    setManager.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 422, error: "Repetido." },
          }),
      ),
    );
    const component = setup();
    await component.save();
    expect(component.serverError()).toBe("Repetido.");

    setManager.mockReturnValue(of(team));
    await component.save();

    expect(component.serverError()).toBeNull();
    expect(close).toHaveBeenCalledWith(team);
  });

  it("drops the message when the delegate, the mode or the found delegate changes", async () => {
    const refuse = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 422, error: "Repetido." },
          }),
      );
    setManager.mockReturnValue(refuse());
    const component = setup();
    // The effect runs once when the dialog opens
    TestBed.tick();
    const refused = async () => {
      await component.save();
      TestBed.tick();
      expect(component.serverError()).toBe("Repetido.");
    };

    await refused();
    component.managerForm.email().value.set("otra@example.com");
    TestBed.tick();
    expect(component.serverError()).toBeNull();

    // A code is needed to save in the "code" mode
    component.managerForm.user_code().value.set("ABC01");
    TestBed.tick();
    await refused();
    component.managerForm.mode().value.set("code");
    TestBed.tick();
    expect(component.serverError()).toBeNull();

    await refused();
    component.managerForm.user_code().value.set("OTRA01");
    TestBed.tick();
    expect(component.serverError()).toBeNull();

    await refused();
    component.found.set({
      user_id: 9,
      first_name: "Zoe",
      last_name: "Ruiz",
      photo_url: null,
    });
    TestBed.tick();
    expect(component.serverError()).toBeNull();
  });
});
