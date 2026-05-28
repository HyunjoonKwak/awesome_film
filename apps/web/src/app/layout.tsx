import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { RegisterSW } from "./register-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "cut_editor — AI-native video editor",
  description:
    "Open-source, collaborative, AI-native video editor for web, desktop, and mobile.",
  applicationName: "cut_editor",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black", title: "cut_editor" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="h-screen overflow-hidden">
        {children}
        <Toaster theme="dark" position="bottom-right" />
        <RegisterSW />
      </body>
    </html>
  );
}
