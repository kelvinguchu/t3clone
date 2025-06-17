"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Settings, Sun, Moon } from "lucide-react";

export function ChatHeader() {
  const { open } = useSidebar();

  return (
    <>
      {/* Fixed positioned sidebar trigger that's always visible in top-left */}
      <SidebarTrigger className="fixed top-2 left-2 z-50 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700" />

      {/* Main header content */}
      <div
        className={`flex items-center h-6 justify-end p-2 pl-12 transition-colors duration-200 ${
          open
            ? "bg-purple-100 dark:bg-purple-900"
            : "bg-purple-50 dark:bg-purple-900"
        }`}
      >
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
    </>
  );
}
