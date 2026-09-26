import { DateTime } from "luxon";

export interface AppNotification {
  id: string;
  /** Material icon id, e.g. `mat:info` */
  icon: string;
  label: string;
  /** Tailwind text color class for the icon, e.g. `text-primary-600` */
  colorClass: string;
  datetime: DateTime;
  read: boolean;
}
