import { toAppUser } from "./authenticated-user.mapper";

describe("toAppUser", () => {
  it("maps the name, the avatar and only the known roles", () => {
    const user = toAppUser({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      photo_url: "",
      roles: [
        { id: 1, code: "superadmin", name: "Super Administrador" },
        { id: 99, code: "unknown", name: "Desconocido" },
      ],
    });

    expect(user.name).toBe("Ada Lovelace");
    expect(user.roles).toEqual(["superadmin"]);
    expect(user.role).toBe("Super Administrador, Desconocido");
    expect(user.avatarUrl).toBe("assets/img/avatars/default.jpg");
  });
});
