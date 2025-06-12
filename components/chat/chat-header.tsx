"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Settings, Sun, Moon } from "lucide-react";

export function ChatHeader() {
  return (
    <div className="flex items-center h-6 justify-between p-2 bg-purple-100 dark:bg-purple-900">
      <SidebarTrigger className="hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors" />

      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg"
          title="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
        </Button>
      </div>
    </div>
  );
}
