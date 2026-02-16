import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-glow rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition-[transform,box-shadow,border-color] duration-250 ease-[var(--ease-standard)] hover:-translate-y-[1px] hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}
