export type NutriBoardRow = {
  patient_id: string;
  name: string;
  risk_level: "low" | "medium" | "high";
  risk_reasons: string[];
  last_checkin_at: string | null;
  adherence_14d: number;
  symptoms: {
    stress: number;
    bloating: number;
    reflux: number;
  };
  has_pending_review: boolean;
};
