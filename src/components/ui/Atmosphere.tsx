import { cn } from "@/lib/utils/cn";

export function Atmosphere({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("atmosphere pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="atmo-orb atmo-orb-a" />
      <div className="atmo-orb atmo-orb-b" />
      <div className="atmo-orb atmo-orb-c" />
      <div className="atmo-grain" />
    </div>
  );
}
