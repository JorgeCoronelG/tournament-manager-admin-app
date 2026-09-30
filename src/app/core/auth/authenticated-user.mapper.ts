import { AppUser } from "../user/current-user.service";
import { AuthenticatedUser } from "./login-response.model";
import { toRoles } from "./role.model";

export function toAppUser(user: AuthenticatedUser): AppUser {
  return {
    name: [user.first_name, user.last_name].filter(Boolean).join(" "),
    role: user.roles.map((role) => role.name).join(", "),
    roles: toRoles(user.roles.map((role) => role.code)),
    avatarUrl: user.photo_url || null,
  };
}
