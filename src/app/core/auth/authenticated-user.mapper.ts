import { AppUser } from "../user/current-user.service";
import { AuthenticatedUser } from "./login-response.model";

const DEFAULT_AVATAR_URL = "assets/img/avatars/default.jpg";

export function toAppUser(user: AuthenticatedUser): AppUser {
  return {
    name: [user.name, user.surnames].filter(Boolean).join(" "),
    role: "",
    avatarUrl: user.photo_url || DEFAULT_AVATAR_URL,
  };
}
