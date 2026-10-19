import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://plancheck-eight.vercel.app"),
  title: "Plancheck",
  description:
    "Upload a PDF. Get a pass/fail checklist against SANS 10400 before you submit.",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Plancheck",
    title: "Plancheck",
    description:
      "Upload a PDF. Get a pass/fail checklist against SANS 10400 before you submit.",
    images: [
      {
        url: "/og/main@2x.png",
        width: 2400,
        height: 1260,
        alt: "Plancheck. Check plans against SANS 10400.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/main@2x.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans antialiased", geist.variable, geistMono.variable)}
    >
      <body>
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2" href="#main">
          Skip to content
        </a>
        <Providers>
          <div id="main">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
