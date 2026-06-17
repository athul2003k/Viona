import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { ClerkProvider } from "@clerk/nextjs";
import { AppInitializer } from "@/components/AppInitializer";
import { Toaster } from "@/components/ui/sonner"
import { Provider } from "jotai";

import { clerkAppearance } from "@/lib/clerk-appearance";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Viona Pro",
  description: "Take Your Business to the Next Level",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider 
      afterSignOutUrl={"/landing"}
      appearance={clerkAppearance}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <AppProviders>
            <AppInitializer>
              <Provider>
                {children}
              </Provider>
            </AppInitializer>
           < Toaster />
          </AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
