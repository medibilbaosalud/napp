"use client";

import * as React from "react";
import { captureClientError } from "@/lib/diagnostics/client";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureClientError(error, {
      severity: "fatal",
      component: "react.boundary",
      context: { componentStack: info.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-red-50 p-4">
            <p className="text-sm font-semibold text-[var(--danger)]">Se produjo un error inesperado.</p>
            <p className="mt-1 text-xs text-[var(--danger)]/90">
              El incidente se ha registrado con detalle para diagnostico.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
