import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Plancheck — Vedalken",
  description:
    "Upload a .dwg. Get a pass/fail checklist against SANS 10400 before you submit. Finding first. Fixing is the job.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="frame">
          <header className="bar">
            <a className="wordmark" href="https://vedalken.dev">
              Vedalken
            </a>
            <span className="product">Plancheck</span>
          </header>
          <hr className="rule" />
          <main id="main" className="main">
            {children}
          </main>
          <hr className="rule" />
          <footer className="signoff">
            Luqmaan Sayed ·{" "}
            <a href="https://vedalken.dev">vedalken.dev</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
