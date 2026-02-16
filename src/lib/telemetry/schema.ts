import { z } from "zod";

export const telemetryContextSchema = z.record(z.string(), z.unknown()).default({});

export const telemetryEventSchemaV2 = z.object({
  schemaVersion: z.literal(2),
  eventName: z.string().min(1).max(120),
  source: z.enum(["web", "pwa"]).optional(),
  context: telemetryContextSchema.optional(),
});

export const telemetryLegacySchema = z.object({
  eventName: z.string().min(1).max(120),
  context: telemetryContextSchema.optional(),
});

export type TelemetryEventV2Input = z.infer<typeof telemetryEventSchemaV2>;
