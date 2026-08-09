import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";

// UCLA Anderson's site (anderson.ucla.edu) runs on the licensed "freight-sans-pro"
// with "Open Sans" as its own fallback — we use Open Sans directly so Anderfy's
// typography feels like a natural extension of the Anderson site.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Anderfy — Anderson-Format Resume Builder",
  description:
    "Build a UCLA Anderson-style resume tailored to a specific job posting, whether you're starting from scratch or an existing resume.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${openSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
