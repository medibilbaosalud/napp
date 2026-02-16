import type { ChallengePayload, MissionCompletionPayload, PatientMission } from "@/lib/types/engagement";

type ChallengeFeedResponse = {
  role: "patient" | "nutri";
  challenges: ChallengePayload[];
  missions: PatientMission[];
};

/**
 * Fetches the challenge feed for the current user.
 * Returns challenges and missions based on the user's role (patient or nutritionist).
 */
export async function fetchChallengeFeed(): Promise<ChallengeFeedResponse> {
  const res = await fetch("/api/challenges/feed", { method: "GET" });
  const data = (await res.json().catch(() => ({}))) as ChallengeFeedResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo cargar retos");
  return data;
}

/**
 * Enrolls a patient in a specific challenge.
 */
export async function enrollInChallenge(challengeId: string): Promise<void> {
  const res = await fetch("/api/challenges/enroll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challengeId }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo unir al reto");
}

/**
 * Marks a mission as completed for the patient.
 */
export async function completeMission(payload: MissionCompletionPayload): Promise<void> {
  const res = await fetch("/api/challenges/complete-mission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la mision");
}
