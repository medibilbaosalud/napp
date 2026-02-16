"use client";

import * as React from "react";
import { captureClientError } from "@/lib/diagnostics/client";

export function GlobalErrorListeners() {
  React.useEffect(() => {
    const onError = (event: ErrorEvent) => {
      captureClientError(event.error ?? new Error(event.message), {
        severity: "error",
        component: "window.error",
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      captureClientError(event.reason, {
        severity: "fatal",
        component: "window.unhandledrejection",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
