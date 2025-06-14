import { SidebarHeader } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

export type ChatSidebarHeaderProps = {
  handleNewChat: () => void;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

export function ChatSidebarHeader({
  handleNewChat,
  searchQuery,
  setSearchQuery,
}: Readonly<ChatSidebarHeaderProps>) {
  return (
    <SidebarHeader className="p-4 pb-3 bg-purple-100 dark:bg-purple-900">
      {/* Brand Header */}
      <div className="flex items-center justify-center">
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
          T3.chat
        </h1>
      </div>

      {/* New Chat Button */}
      <Button
        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-purple-500/40 hover:scale-[1.02] group h-9"
        onClick={handleNewChat}
      >
        <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
        Start New Chat
      </Button>

      {/* Search */}
      <div className="relative mt-3">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-purple-400" />
        <Input
          placeholder="Search conversations..."
          className="pl-8 h-8 text-sm bg-white/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50 focus:border-purple-400 focus:ring-purple-400/20 placeholder:text-purple-400/70"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
    </SidebarHeader>
  );
}
