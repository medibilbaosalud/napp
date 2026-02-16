"use client";

import type { DiagnosticPayload } from "@/lib/diagnostics/schema";

function getFingerprint(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash)}`;
}

function getEnvironmentSnapshot() {
  if (typeof window === "undefined") return {};
  const nav = window.navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };

  return {
    href: window.location.href,
    userAgent: nav.userAgent,
    language: nav.language,
    platform: nav.platform,
    online: nav.onLine,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    memory: nav.deviceMemory ?? null,
    connection: nav.connection
      ? {
          effectiveType: nav.connection.effectiveType ?? null,
          downlink: nav.connection.downlink ?? null,
          rtt: nav.connection.rtt ?? null,
          saveData: nav.connection.saveData ?? null,
        }
      : null,
  };
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const causeMessage =
      typeof error.cause === "string"
        ? error.cause
        : error.cause instanceof Error
          ? `${error.cause.name}: ${error.cause.message}`
          : undefined;
    return {
      errorName: error.name || "Error",
      errorMessage: error.message || "Unknown error",
      stack: error.stack,
      context: causeMessage ? { cause: causeMessage } : {},
    };
  }
  return {
    errorName: "UnknownError",
    errorMessage: typeof error === "string" ? error : "Unknown error payload",
    stack: undefined,
    context: {},
  };
}

export async function captureClientError(
  error: unknown,
  extras?: Omit<Partial<DiagnosticPayload>, "errorName" | "errorMessage" | "stack">,
) {
  const serialized = serializeError(error);
  const route = extras?.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined);
  const fingerprintSeed = `${serialized.errorName}:${serialized.errorMessage}:${route ?? ""}`;
  const payload: DiagnosticPayload = {
    route,
    component: extras?.component,
    severity: extras?.severity ?? "error",
    errorName: serialized.errorName,
    errorMessage: serialized.errorMessage,
    errorCode: extras?.errorCode,
    stack: serialized.stack,
    fingerprint: extras?.fingerprint ?? getFingerprint(fingerprintSeed),
    context: {
      ...serialized.context,
      ...(extras?.context ?? {}),
    },
    environment: {
      ...getEnvironmentSnapshot(),
      ...(extras?.environment ?? {}),
    },
  };

  try {
    await fetch("/api/diagnostics/error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best effort only.
  }
}
