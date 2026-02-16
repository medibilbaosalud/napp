import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-glow rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color,background-color] duration-[var(--motion-component)] ease-[var(--ease-standard)] will-change-transform hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--accent),var(--line)_72%)] hover:shadow-[var(--shadow-md)] active:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}
