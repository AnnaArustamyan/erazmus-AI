import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { RegisterForm } from "@/components/auth/register-form";
import { Providers } from "@/components/providers";

export default function RegisterPage() {
  return (
    <Providers>
      <div className="flex min-h-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
                E+
              </div>
              <span className="text-lg font-semibold">Erasmus AI</span>
            </Link>
            <h1 className="mt-6 text-2xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with 100,000 free tokens every month
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8">
            <RegisterForm />
          </div>

          <div className="mt-4 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </Providers>
  );
}
