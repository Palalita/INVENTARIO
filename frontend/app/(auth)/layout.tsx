export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 size-96 rounded-full bg-primary/25 blur-3xl dark:bg-primary/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-40 size-96 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_40%,black,transparent)]"
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
