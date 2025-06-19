import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { FilePreviewProvider } from "@/lib/contexts/file-preview-context";
import { AnonymousSessionProvider } from "@/lib/contexts/anonymous-session-context";
import { ThreadsCacheProvider } from "@/lib/contexts/threads-cache-context";
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

export const metadata: Metadata = {
  title: "T3 Chat - AI Conversations",
  description: "Modern AI chat interface with all models.",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
  },
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

export const viewport: Viewport = {
  themeColor: "#4c0fd0",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="T3 Chat" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="T3 Chat" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#4c0fd0" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-icon" href="/icon512_rounded.png" />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/icon512_rounded.png"
        />
        <link rel="apple-touch-startup-image" href="/icon512_rounded.png" />
        <link rel="mask-icon" href="/logo.svg" color="#4c0fd0" />
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
                  <ThreadsCacheProvider>
                    <HotkeyProvider>
                      {children}
                      <GlobalChatSearch />
                      <Toaster />
                    </HotkeyProvider>
                  </ThreadsCacheProvider>
                </AnonymousSessionProvider>
              </FilePreviewProvider>
            </ConvexClientProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
