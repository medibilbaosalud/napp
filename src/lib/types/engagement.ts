export type EngagementEventName =
  | "view_today"
  | "complete_action"
  | "save_checkin"
  | "save_photo"
  | "view_progress"
  | "open_plan"
  | "submit_nps";

export type EngagementEventPayload = {
  eventName: EngagementEventName;
  context?: Record<string, unknown>;
};

export type PatientHomePayload = {
  date: string;
  week_start: string;
  daily_score: number;
  streak_days: number;
  week_checkins: number;
  week_adherence_pct: number;
  goal: {
    type: string;
    target: number;
    current: number;
    status: "active" | "completed" | "missed";
  };
  latest_symptoms: {
    stress: number;
    bloating: number;
    reflux: number;
  };
  next_best_action: "checkin" | "photo" | "review_plan";
  nudge: string;
};

export type NpsSubmitPayload = {
  score: number;
  comment?: string;
  context?: Record<string, unknown>;
};
