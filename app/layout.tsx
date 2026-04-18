import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meemaw Assist — tech help that actually helps",
  description:
    "Talk to a patient AI helper that explains tech problems in plain language. Built at Hack Kosice.",
  manifest: "/manifest.json",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-meemaw-bg text-meemaw-ink">
        {children}
      </body>
    </html>
  );
}
