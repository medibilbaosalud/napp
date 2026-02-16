import type { OnboardingStepState } from "@/lib/types/engagement";

type OnboardingGetResponse = {
  steps: Array<{
    step_key: string;
    step_data: Record<string, unknown>;
    completed: boolean;
    source_channel: string;
    updated_at: string;
  }>;
  latestStep: string | null;
};

/**
 * Saves the progress of a specific onboarding step.
 */
export async function saveOnboardingStep(payload: OnboardingStepState) {
  const res = await fetch("/api/onboarding/fast-start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar onboarding");
}

/**
 * Retrieves the current state of onboarding for the user.
 */
export async function getOnboardingState() {
  const res = await fetch("/api/onboarding/fast-start", { method: "GET" });
  const data = (await res.json().catch(() => ({}))) as OnboardingGetResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo cargar onboarding");
  return data;
}
