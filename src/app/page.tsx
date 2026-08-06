import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            E+
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Erasmus AI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
          Erasmus+ Grant Assistant
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Design, audit, and finalize your Erasmus+ applications
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          AI-powered chat, specialized compliance agents, and a full grant
          application generator — built for NGOs, youth workers, and educational
          institutions.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-accent px-8 py-3 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Start free — 100K tokens/month
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-border bg-card px-8 py-3 text-base font-semibold transition-colors hover:bg-muted"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              title: "AI Chat",
              desc: "Context-aware guidance on Erasmus+ rules, methodology, and grant writing.",
            },
            {
              title: "Specialized Agents",
              desc: "Compliance, budget, partner outreach, and report writing — automated.",
            },
            {
              title: "Grant Generator",
              desc: "Step-by-step wizard producing production-ready PDF, Word, and Markdown exports.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-6 text-left"
            >
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        Erasmus AI Assistant &mdash; MVP in development
      </footer>
    </div>
  );
}
