import { WaitlistForm } from "@/app/waitlist/waitlist-form";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseEmail } from "@/lib/auth/waitlist";
import { getAllowedUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Plancheck waitlist",
  description: "The drawing should fail in your office. Not at the counter.",
  openGraph: {
    type: "website",
    url: "/waitlist",
    siteName: "Plancheck",
    title: "Plancheck waitlist",
    description: "The drawing should fail in your office. Not at the counter.",
    images: [
      {
        url: "/og/waitlist@2x.png",
        width: 2400,
        height: 1260,
        alt: "Plancheck waitlist. The drawing should fail in your office. Not at the counter.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/waitlist@2x.png"],
  },
};

type WaitlistPageProps = {
  searchParams: Promise<{ email?: string | string[]; joined?: string | string[] }>;
};

export default async function WaitlistPage({ searchParams }: WaitlistPageProps) {
  const params = await searchParams;
  const user = await getAllowedUser();
  if (user) {
    redirect("/plancheck");
  }

  const emailRaw = Array.isArray(params.email) ? params.email[0] : params.email;
  const parsedEmail = parseEmail(emailRaw);
  const email = parsedEmail.ok ? parsedEmail.value : "";
  const joinedFlag = Array.isArray(params.joined) ? params.joined[0] : params.joined;
  const joined = joinedFlag === "1";

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <p className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          Plancheck
        </p>
        <ThemeToggle />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-center lg:py-24">
        <section className="max-w-xl space-y-6">
          <p className="text-sm text-muted-foreground">Not open.</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-pretty md:text-4xl">
            The drawing should fail in your office. Not at the counter.
          </h1>
          <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              If you prepare building plans in South Africa, you already know
              the cost of a missed item. Plancheck reads a drawing and tells
              you what passes SANS 10400, and what does not — before the file
              leaves the office.
            </p>
            <p>
              It is not a stamp. It is not municipal approval. The competent
              person and the owner still sign. We are not selling a shortcut
              around that.
            </p>
            <p>
              Leave your name. When the door opens, we will write. One letter.
              No brochure.
            </p>
          </div>
        </section>
        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {joined ? "You are on the list." : "Leave your name."}
              </CardTitle>
              <CardDescription>
                {joined
                  ? "We will write when Plancheck is ready to use. Not before."
                  : "Name, email, and the seat you occupy. That is all we need to write to you later."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {joined ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {email ? `${email}. ` : ""}The name is in. You can close this page.
                </p>
              ) : (
                <WaitlistForm email={email} />
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
