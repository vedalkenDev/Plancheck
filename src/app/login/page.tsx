import { LoginForm } from "@/app/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { getAllowedUser } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in — Plancheck",
};

export default async function LoginPage() {
  const user = await getAllowedUser();
  if (user) {
    redirect("/plancheck");
  }

  return (
    <div className="public-screen flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <p className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          Plancheck
        </p>
        <ThemeToggle className="size-11 focus-visible:ring-ring md:size-8" />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="font-heading text-xl leading-snug font-medium">
              Sign in
            </h1>
            <CardDescription className="space-y-2">
              <span className="block">
                The drawing should fail in your office. Not at the counter.
              </span>
              <span className="block">Write the email you use at work.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm />
            <p>
              <Link
                href="/waitlist"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Not on the list yet? Leave your name
              </Link>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              It is not a stamp. It is not municipal approval. The competent
              person and the owner still sign.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
