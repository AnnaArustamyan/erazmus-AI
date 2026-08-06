"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2"
            placeholder="you@organization.org"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </button>
      </form>

      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Continue with Google
          </button>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
