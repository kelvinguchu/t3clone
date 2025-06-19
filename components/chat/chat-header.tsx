"use client";

import { useState, useEffect } from "react";
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
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

export function ChatHeader() {
  const { open } = useSidebar();
  const { user } = useUser();
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  // Theme functionality with safe mounting
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

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
        <SidebarTrigger className="text-purple-900 cursor-pointer dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent" />

        {/* Settings and Theme buttons - always visible on desktop */}
        <button
          className="size-7 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center cursor-pointer"
          title="Settings"
          onClick={() => {
            router.push("/settings/customization");
          }}
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Theme toggle button - safe implementation */}
        {mounted ? (
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="size-7 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center cursor-pointer"
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="size-7 bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center">
            <div className="h-4 w-4 bg-purple-300 dark:bg-dark-purple-light rounded animate-pulse" />
          </div>
        )}

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
                  className="h-7 px-3 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center gap-1 cursor-pointer"
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
                  className="size-7 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center cursor-pointer"
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

      {/* Main header */}
      <div
        className={`fixed top-0 left-0 right-0 md:relative md:top-auto md:left-auto md:right-auto flex items-center justify-between h-11 md:h-6 p-3 md:p-2 transition-colors duration-200 z-[50] ${
          open ? "md:pl-12" : "md:pl-24"
        } ${
          open
            ? "bg-purple-100 dark:bg-dark-bg-secondary"
            : "bg-purple-50 dark:bg-dark-bg"
        } border-b border-purple-200 dark:border-dark-purple-accent md:border-b-0`}
      >
        {/* Mobile sidebar trigger */}
        <div className="md:hidden">
          <SidebarTrigger className="size-9 md:size-auto text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent [&>svg]:h-5 [&>svg]:w-5 md:[&>svg]:h-4 md:[&>svg]:w-4" />
        </div>

        {/* Centered title */}
        <h1 className="text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-800 dark:from-dark-purple-glow dark:to-purple-400 bg-clip-text text-transparent flex-1 text-center">
          T3 Chat
        </h1>

        {/* Mobile menu button */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="size-9 md:size-7 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary transition-colors bg-purple-100 dark:bg-dark-bg-secondary backdrop-blur-sm border border-purple-200 dark:border-dark-purple-accent rounded-md flex items-center justify-center cursor-pointer"
            title="Menu"
          >
            <MoreVertical className="h-5 w-5 md:h-4 md:w-4" />
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
              className="fixed top-0 right-0 h-full w-72 bg-purple-100 dark:bg-dark-bg-secondary shadow-2xl z-[60] md:hidden border-l border-purple-200 dark:border-dark-purple-accent"
            >
              {/* Menu header */}
              <div className="flex items-center justify-between p-4 border-b border-purple-200 dark:border-dark-purple-accent">
                <h2 className="text-lg font-semibold text-purple-900 dark:text-slate-200">
                  Menu
                </h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="size-8 text-purple-600 dark:text-slate-400 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Menu content */}
              <div className="p-4 space-y-3">
                {/* Settings button */}
                <button
                  className="w-full flex items-center gap-3 p-3 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors cursor-pointer"
                  onClick={() => {
                    // Handle settings
                    setMobileMenuOpen(false);
                  }}
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </button>

                {/* Theme toggle button */}
                {mounted ? (
                  <button
                    className="w-full flex items-center gap-3 p-3 text-purple-900 dark:text-slate-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors cursor-pointer"
                    onClick={() => {
                      setTheme(resolvedTheme === "dark" ? "light" : "dark");
                      setMobileMenuOpen(false);
                    }}
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                    <span className="font-medium">
                      Switch to {resolvedTheme === "dark" ? "light" : "dark"}{" "}
                      mode
                    </span>
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-3 p-3 text-purple-900 dark:text-slate-200">
                    <div className="h-5 w-5 bg-purple-300 dark:bg-dark-purple-light rounded animate-pulse" />
                    <div className="h-4 w-24 bg-purple-300 dark:bg-dark-purple-light rounded animate-pulse" />
                  </div>
                )}
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
