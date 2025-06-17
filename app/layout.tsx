import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans_Mono, Rubik } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { FilePreviewProvider } from "@/lib/contexts/file-preview-context";
import { AnonymousSessionProvider } from "@/lib/contexts/anonymous-session-context";
import { Toaster } from "@/components/ui/sonner";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const notoSansMono = Noto_Sans_Mono({
  variable: "--font-noto-sans-mono",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "T3.chat - AI Conversations",
  description: "Modern AI chat interface powered by T3 stack",
  icons: {
    icon: "/convex.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://unpkg.com/react-scan/dist/auto.global.js" />
      </head>
      <body
        className={`${rubik.className} font-mono antialiased bg-purple-100 dark:bg-purple-900`}
      >
        <ClerkProvider dynamic>
          <ConvexClientProvider>
            <FilePreviewProvider>
              <AnonymousSessionProvider>
                {children}
                <Toaster />
              </AnonymousSessionProvider>
            </FilePreviewProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
