export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Phase 1 Complete — Foundation Active
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Mega Auction V1
        </h1>
        <p className="text-lg text-muted-foreground">
          Real-time IPL-style multiplayer sports auction application built with Next.js 15,
          TypeScript, Supabase PostgreSQL, and Tailwind CSS.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <a
            href="/login"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Sign In
          </a>
          <a
            href="/signup"
            className="rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Create Account
          </a>
        </div>
      </div>
    </main>
  );
}
