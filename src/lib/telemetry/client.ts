import type { EngagementEventPayload } from "@/lib/types/engagement";

export async function trackEvent(payload: EngagementEventPayload) {
  try {
    await fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best effort only.
  }
}
