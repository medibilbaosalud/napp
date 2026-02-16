export type EngagementEventName =
  | "view_today"
  | "complete_action"
  | "save_checkin"
  | "save_photo"
  | "view_progress"
  | "open_plan"
  | "submit_nps"
  | "ask_coach"
  | "export_data"
  | "update_profile"
  | "auth_view_signup"
  | "auth_view_login"
  | "auth_oauth_start"
  | "auth_oauth_success"
  | "auth_oauth_error"
  | "onboarding_step_saved"
  | "onboarding_complete"
  | "mission_complete"
  | "challenge_enroll"
  | "challenge_view_feed"
  | "retention_weekly_summary_view";

export type EngagementEventPayload = {
  eventName: EngagementEventName;
  context?: Record<string, unknown>;
};

export type EngagementEventV2 = {
  schemaVersion: 2;
  eventName: EngagementEventName;
  context?: Record<string, unknown>;
  source?: "web" | "pwa";
};

export type OnboardingStepKey =
  | "profile"
  | "tracking"
  | "link"
  | "consent"
  | "complete";

export type OnboardingStepState = {
  stepKey: OnboardingStepKey;
  stepData: Record<string, unknown>;
  completed: boolean;
  sourceChannel?: string;
};

export type ChallengePayload = {
  challengeId: string;
  title: string;
  description: string;
  status: "draft" | "active" | "archived";
  startsOn: string;
  endsOn: string | null;
  rewardBadge: string | null;
  enrolled: boolean;
  progress: number;
};

export type MissionCompletionPayload = {
  missionId: string;
  completionKey?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

export type PatientMission = {
  id: string;
  mission_key: string;
  title: string;
  target_value: number;
  completed: boolean;
};

export type WeeklyChallengeStatus = {
  active: number;
  missions_completed_today: number;
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
  missions_today?: PatientMission[];
  streak_protection_available?: boolean;
  weekly_challenge_status?: WeeklyChallengeStatus;
  reward_level?: "starter" | "bronze" | "silver" | "gold";
  next_best_action: "checkin" | "photo" | "review_plan";
  nudge: string;
};

export type NpsSubmitPayload = {
  score: number;
  comment?: string;
  context?: Record<string, unknown>;
};
