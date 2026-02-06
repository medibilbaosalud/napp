import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh app-shell">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-10">
        <header className="mb-8">
          <Link href="/" className="text-sm font-semibold text-[var(--accent)]">
            MediBilbao Salud
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--text)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}

