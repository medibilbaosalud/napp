import type { EngagementEventPayload, EngagementEventV2 } from "@/lib/types/engagement";

type TrackPayload = EngagementEventPayload | EngagementEventV2;

export async function trackEvent(payload: TrackPayload) {
  const body =
    "schemaVersion" in payload
      ? payload
      : ({
          schemaVersion: 2 as const,
          eventName: payload.eventName,
          context: payload.context ?? {},
          source: "web" as const,
        } satisfies EngagementEventV2);

  try {
    await fetch("/api/telemetry/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Best effort only.
  }
}
