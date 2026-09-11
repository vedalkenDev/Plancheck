import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "Plancheck — Vedalken",
  description:
    "Upload a drawing. Get SANS pass or fail, and what to adjust. Finding first. Fixing is the job.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "bg-paper font-sans antialiased",
        inter.variable,
        newsreader.variable,
      )}
    >
      <body className="flex min-h-svh flex-col bg-paper text-ink">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-paper focus:px-3 focus:py-2 focus:text-ink"
          href="#main"
        >
          Skip to content
        </a>
        <header className="flex items-baseline justify-between px-6 py-8 md:px-12">
          <a href="https://vedalken.dev" className="text-sm tracking-wide">
            Vedalken
          </a>
          <p className="text-sm text-stone">Plancheck</p>
        </header>
        <Providers>
          <div id="main" className="flex-1">
            {children}
          </div>
        </Providers>
        <footer className="px-6 py-10 md:px-12">
          <p className="text-sm text-stone">
            Luqmaan Sayed ·{" "}
            <a href="https://vedalken.dev" className="text-ink">
              vedalken.dev
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
