import type { Metadata } from "next";
import { Noto_Sans_Mono } from "next/font/google";

import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { FilePreviewProvider } from "@/lib/contexts/file-preview-context";

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
      <body
        className={`${notoSansMono.className} font-mono antialiased bg-purple-100 dark:bg-purple-900`}
      >
        <ClerkProvider dynamic>
          <ConvexClientProvider>
            <FilePreviewProvider>{children}</FilePreviewProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
