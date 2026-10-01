import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in — Plancheck",
};

const ERRORS: Record<string, string> = {
  unauthorized: "That Google account isn't allowed on this build.",
  oauth: "Google sign-in didn't start. Enable the Google provider in Supabase first.",
  auth: "Sign-in didn't finish. Try again.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  if (hasSupabaseConfig()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getClaims();
    const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
    if (isAllowedEmail(email)) {
      redirect("/plancheck");
    }
  }

  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const message = error && error in ERRORS ? ERRORS[error] : null;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          Plancheck
        </h1>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              This build is limited to one Google account. Continue with that
              account to open Plancheck.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
            {hasSupabaseConfig() ? (
              <form action="/auth/google" method="post">
                <Button className="w-full" size="lg" type="submit">
                  <GoogleMark />
                  Continue with Google
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Supabase auth keys are missing, so Google sign-in is unavailable.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.83Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.01c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.14 15.23 0 12 0A12 12 0 0 0 1.27 6.6l4 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
