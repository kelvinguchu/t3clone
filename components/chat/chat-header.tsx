"use client";

import { useState } from "react";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Settings,
  Sun,
  Moon,
  Search,
  Plus,
  MoreVertical,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatSearchDialog } from "./chat-search-dialog";
import {
  useThreadsFetcher,
  useThreadCreator,
  useNewChatHandler,
} from "@/lib/actions/chat/chat-sidebar";
import { useUser } from "@clerk/nextjs";

export function ChatHeader() {
  const { open } = useSidebar();
  const { user } = useUser();
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Use extracted utilities for new chat functionality
  const { threadsData, sessionId, sessionData } = useThreadsFetcher();
  const threadCreator = useThreadCreator(user);
  const handleNewChat = useNewChatHandler({
    user,
    sessionId,
    sessionData,
    threadsData,
    threadCreator,
  });

  return (
    <>
      {/* Fixed positioned controls in top-left - Desktop only */}
      <div className="hidden md:flex fixed top-2 left-2 z-[60] items-center gap-1">
        <SidebarTrigger className="text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700" />

        {/* Settings and Theme buttons - always visible on desktop */}
        <button
          className="size-7 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-md flex items-center justify-center"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          className="size-7 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-md flex items-center justify-center"
          title="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:block" />
        </button>

        {/* Search and New Chat buttons - animate in when sidebar is closed */}
        <AnimatePresence>
          {!open && (
            <>
              {/* Search button */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
              >
                <motion.button
                  onClick={() => setSearchDialogOpen(true)}
                  className="h-7 px-3 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-md flex items-center justify-center gap-1"
                  title="Search conversations"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Search className="h-4 w-4" />
                  <span className="text-xs font-medium">Search</span>
                </motion.button>
              </motion.div>

              {/* New chat button */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
              >
                <motion.button
                  onClick={handleNewChat}
                  className="size-7 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-md flex items-center justify-center"
                  title="Start new chat"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="h-4 w-4" />
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Main header - Fixed on mobile, increased height */}
      <div
        className={`fixed top-0 left-0 right-0 md:relative md:top-auto md:left-auto md:right-auto flex items-center justify-between h-9 md:h-6 p-3 md:p-2 transition-colors duration-200 z-[50] ${
          open ? "md:pl-12" : "md:pl-24"
        } ${
          open
            ? "bg-purple-100 dark:bg-purple-900"
            : "bg-purple-50 dark:bg-purple-900"
        } border-b border-purple-200 dark:border-purple-700 md:border-b-0`}
      >
        {/* Mobile sidebar trigger */}
        <div className="md:hidden">
          <SidebarTrigger className="text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700" />
        </div>

        {/* Centered title */}
        <h1 className="text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent flex-1 text-center">
          T3 Chat
        </h1>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="size-7 text-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors bg-purple-100 dark:bg-purple-900 backdrop-blur-sm border border-purple-200 dark:border-purple-700 rounded-md flex items-center justify-center"
            title="Menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[60] md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-out menu */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-72 bg-purple-100 dark:bg-purple-900 shadow-2xl z-[60] md:hidden border-l border-purple-200 dark:border-purple-700"
            >
              {/* Menu header */}
              <div className="flex items-center justify-between p-4 border-b border-purple-200 dark:border-purple-700">
                <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  Menu
                </h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="size-8 text-purple-600 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Menu content */}
              <div className="p-4 space-y-3">
                {/* Settings button */}
                <button
                  className="w-full flex items-center gap-3 p-3 text-purple-900 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg transition-colors"
                  onClick={() => {
                    // Handle settings
                    setMobileMenuOpen(false);
                  }}
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </button>

                {/* Theme toggle button */}
                <button
                  className="w-full flex items-center gap-3 p-3 text-purple-900 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg transition-colors"
                  onClick={() => {
                    // Handle theme toggle
                    setMobileMenuOpen(false);
                  }}
                >
                  <Sun className="h-5 w-5 dark:hidden" />
                  <Moon className="h-5 w-5 hidden dark:block" />
                  <span className="font-medium">
                    <span className="dark:hidden">Dark mode</span>
                    <span className="hidden dark:block">Light mode</span>
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Dialog */}
      <ChatSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
      />
    </>
  );
}
