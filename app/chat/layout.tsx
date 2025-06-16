import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatHeader } from "@/components/chat/chat-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import type { ReactNode } from "react";

export default function ChatLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SidebarProvider>
      <ChatSidebar />
      <SidebarInset className="flex flex-col !bg-transparent h-screen overflow-hidden">
        <ChatHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
