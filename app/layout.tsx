import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Inventory App",
  description: "Internal inventory management app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inventory App",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}