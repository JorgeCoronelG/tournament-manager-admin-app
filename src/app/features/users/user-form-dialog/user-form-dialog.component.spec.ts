import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { of, throwError } from "rxjs";
import { provideTestI18n } from "../../../../testing/i18n";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { UserFormDialogComponent } from "./user-form-dialog.component";
import { User } from "../user.model";
import { UsersApi } from "../users.api";

const ROLES = [
  { id: 1, code: "league_admin", name: "Admin de liga" },
  { id: 2, code: "player", name: "Jugador" },
];

describe("UserFormDialogComponent", () => {
  const create = vi.fn();
  const update = vi.fn();
  const close = vi.fn();
  const error = vi.fn();

  function setup(data: User | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideTestI18n(),
        {
          provide: UsersApi,
          useValue: {
            create,
            update,
            roles: () => ({
              value: signal(ROLES),
              error: signal(undefined),
              reload: vi.fn(),
            }),
          },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: SnackbarService, useValue: { error } },
      ],
    });

    const fixture = TestBed.createComponent(UserFormDialogComponent);
    fixture.detectChanges();

    return fixture.componentInstance;
  }

  function fill(component: UserFormDialogComponent, roles: number[]) {
    const { userForm } = component;
    userForm.first_name().value.set("Ana");
    userForm.last_name().value.set("Pérez");
    userForm.email().value.set("ana@example.com");
    userForm.roles().value.set(roles);
  }

  beforeEach(() => {
    create.mockReset().mockReturnValue(of({ id: 1 }));
    update.mockReset().mockReturnValue(of({ id: 1 }));
    close.mockReset();
    error.mockReset();
  });

  it("does not submit an empty form", async () => {
    const component = setup();

    await component.save();

    expect(create).not.toHaveBeenCalled();
    expect(component.userForm.first_name().invalid()).toBe(true);
    expect(component.userForm.roles().invalid()).toBe(true);
  });

  it("rejects an invalid email", () => {
    const component = setup();

    component.userForm.email().value.set("nope");

    expect(component.userForm.email().invalid()).toBe(true);
  });

  it("requires the phone only when the player role is selected", () => {
    const component = setup();
    fill(component, [1]);

    expect(component.userForm.phone().invalid()).toBe(false);

    component.userForm.roles().value.set([1, 2]);
    expect(component.userForm.phone().invalid()).toBe(true);

    component.userForm.phone().value.set("5551234567");
    expect(component.userForm.phone().invalid()).toBe(false);
  });

  it("limits names to 3-100 characters", () => {
    const component = setup();
    const { first_name } = component.userForm;

    first_name().value.set("Al");
    expect(first_name().invalid()).toBe(true);
    expect(component.errorText(first_name().errors(), "Al")).toBe(
      "Debe tener al menos 3 caracteres",
    );

    first_name().value.set("Ana");
    expect(first_name().invalid()).toBe(false);

    first_name().value.set("a".repeat(101));
    expect(first_name().invalid()).toBe(true);
    expect(component.errorText(first_name().errors(), "x")).toBe(
      "No puede tener más de 100 caracteres",
    );
  });

  it("accepts a phone of exactly 10 digits, or none", () => {
    const component = setup();
    fill(component, [1]);
    const { phone } = component.userForm;

    expect(phone().invalid()).toBe(false);

    for (const bad of [
      "123456789",
      "12345678901",
      "55512345ab",
      "555 123 4567",
    ]) {
      phone().value.set(bad);
      expect(phone().invalid(), bad).toBe(true);
    }

    phone().value.set("5551234567");
    expect(phone().invalid()).toBe(false);
  });

  it("requires at least one role", () => {
    const component = setup();

    expect(component.userForm.roles().invalid()).toBe(true);
    component.userForm.roles().value.set([1]);
    expect(component.userForm.roles().invalid()).toBe(false);
  });

  it("creates the user with a null phone when it is blank", async () => {
    const component = setup();
    fill(component, [1]);

    await component.save();

    expect(create).toHaveBeenCalledWith({
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: null,
      roles: [1],
    });
    expect(close).toHaveBeenCalledWith({ id: 1 });
    expect(component.saving()).toBe(false);
  });

  it("edits an existing user keeping its active flag", async () => {
    const component = setup({
      id: 9,
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: "5551234567",
      roles: [ROLES[1]],
      is_active: false,
    } as User);

    expect(component.userForm.roles().value()).toEqual([2]);
    await component.save();

    expect(update).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        is_active: false,
        phone: "5551234567",
        roles: [2],
      }),
    );
  });

  it("maps 422 errors to their fields and keeps the dialog open", async () => {
    create.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 422, error: { email: ["El correo ya existe."] } },
          }),
      ),
    );
    const component = setup();
    fill(component, [1]);

    await component.save();

    expect(close).not.toHaveBeenCalled();
    expect(
      component.userForm
        .email()
        .errors()
        .map((e) => e.message),
    ).toEqual(["El correo ya existe."]);
    expect(component.saving()).toBe(false);
  });

  it("shows other failures in a snackbar", async () => {
    create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const component = setup();
    fill(component, [1]);

    await component.save();

    expect(error).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
