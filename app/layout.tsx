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
    statusBarStyle: "black-translucent",
    title: "Inventory App",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
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