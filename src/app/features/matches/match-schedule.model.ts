export interface AvailableSlot {
  /** `HH:mm` */
  start_time: string;
  end_time: string;
  field_id: number;
  field_name: string;
}

/** `GET /matches/{id}/available-slots` */
export interface AvailableSlots {
  date: string | null;
  slots: AvailableSlot[];
}

export interface AvailableReferee {
  id: number;
  name: string;
  available: boolean;
  /** Why it cannot referee: busy somewhere else, or plays in one of the teams */
  reason: string | null;
}

export interface MatchWarning {
  code: string;
  message: string;
}

/** Body of `PATCH /matches/{id}/schedule`; what is not sent stays as it is */
export interface MatchScheduleBody {
  match_datetime?: string | null;
  field_id?: number | null;
  referee_user_id?: number | null;
  schedule_locked?: boolean;
}
