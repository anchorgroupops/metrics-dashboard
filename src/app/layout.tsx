import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Anchor Team — Performance Metrics",
  description: "Zillow Preferred agent performance dashboard for The Anchor Team",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sandy-shore text-black antialiased">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="bg-clear-water text-pearl-aqua py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm" style={{ fontFamily: "'Dax Pro', sans-serif" }}>
            <p>Keep showing up with integrity — that&apos;s what sets great agents apart.</p>
            <p className="text-pearl-aqua/60 mt-1">&copy; {new Date().getFullYear()} The Anchor Team</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
