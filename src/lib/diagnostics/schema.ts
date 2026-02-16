import { z } from "zod";

export const diagnosticSeveritySchema = z.enum(["warning", "error", "fatal"]);

export const diagnosticPayloadSchema = z.object({
  route: z.string().max(300).optional(),
  component: z.string().max(180).optional(),
  severity: diagnosticSeveritySchema.default("error"),
  errorName: z.string().min(1).max(200),
  errorMessage: z.string().min(1).max(4000),
  errorCode: z.string().max(120).optional(),
  stack: z.string().max(30000).optional(),
  fingerprint: z.string().max(200).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  environment: z.record(z.string(), z.unknown()).optional(),
});

export type DiagnosticPayload = z.infer<typeof diagnosticPayloadSchema>;
