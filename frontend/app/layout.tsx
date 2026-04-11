import AppBootstrap from "@/components/app/AppBootstrap";
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "ClaimHeart - AI-Powered Healthcare Claims",
  description: "Smart enough to decide. Human enough to explain why.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: "ClaimHeart",
    description: "AI claims orchestration. Explainable by design.",
    siteName: "ClaimHeart",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppBootstrap>{children}</AppBootstrap>
      </body>
    </html>
  );
}
