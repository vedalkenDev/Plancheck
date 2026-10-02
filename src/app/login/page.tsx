import { GoogleMark } from "@/components/google-mark";
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
    if (email) {
      redirect("/waitlist");
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
              Two people can open Plancheck. Everyone else leaves a name on the
              list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {message ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
            {hasSupabaseConfig() ? (
              <div className="space-y-3">
                <form action="/auth/google" method="post">
                  <Button className="w-full" size="lg" type="submit">
                    <GoogleMark />
                    Continue with Google
                  </Button>
                </form>
                <p className="text-sm text-muted-foreground">
                  Not one of the two?{" "}
                  <a className="underline underline-offset-4 hover:text-foreground" href="/waitlist">
                    Read the list
                  </a>
                  .
                </p>
              </div>
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
