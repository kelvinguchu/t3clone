import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans_Mono, Rubik } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { FilePreviewProvider } from "@/lib/contexts/file-preview-context";
import { AnonymousSessionProvider } from "@/lib/contexts/anonymous-session-context";
import { HotkeyProvider } from "@/lib/contexts/hotkey-context";
import { GlobalChatSearch } from "@/components/chat/global-chat-search";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";

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
  title: "T3 Chat - AI Conversations",
  description: "Modern AI chat interface with all models.",
  icons: {
    icon: "/logo.svg",
  },
  manifest: "/manifest.json",
  themeColor: "#4c0fd0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "T3 Chat",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "T3 Chat",
    title: "T3 Chat - AI Conversations",
    description: "Modern AI chat interface with all models.",
  },
  twitter: {
    card: "summary",
    title: "T3 Chat - AI Conversations",
    description: "Modern AI chat interface with all models.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="application-name" content="T3 Chat" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="T3 Chat" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#4c0fd0" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/icon512_rounded.png" />
        <link rel="mask-icon" href="/logo.svg" color="#4c0fd0" />
        <Script src="https://unpkg.com/react-scan/dist/auto.global.js" />
      </head>
      <body
        className={`${rubik.className} font-mono antialiased bg-purple-100 dark:bg-dark-bg`}
      >
        <NextSSRPlugin
          /**
           * The `extractRouterConfig` will extract **only** the route configs
           * from the router to prevent additional information from being
           * leaked to the client. The data passed to the client is the same
           * as if you were to fetch `/api/uploadthing` directly.
           */
          routerConfig={extractRouterConfig(ourFileRouter)}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider dynamic>
            <ConvexClientProvider>
              <FilePreviewProvider>
                <AnonymousSessionProvider>
                  <HotkeyProvider>
                    {children}
                    <GlobalChatSearch />
                    <Toaster />
                  </HotkeyProvider>
                </AnonymousSessionProvider>
              </FilePreviewProvider>
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
