"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useEffect } from "react";

const getPageTitle = (pathname: string) => {
  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];

  switch (lastSegment) {
    case "settings":
      return "Settings";
    case "account":
      return "Account";
    case "customization":
      return "Customization";
    case "history":
      return "History";
    case "models":
      return "Models";
    case "api-keys":
      return "API Keys";
    case "attachments":
      return "Attachments";
    case "contact":
      return "Contact Us";
    default:
      return "Settings";
  }
};

export function SettingsHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { toggleSidebar, setOpenMobile, isMobile } = useSidebar();

  // Ensure sidebar is always open on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // md breakpoint
        setOpenMobile(true);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setOpenMobile]);

  const handleToggle = () => {
    // Only allow toggle on mobile
    if (isMobile) {
      toggleSidebar();
    }
  };

  return (
    <div className="sticky top-0 z-50 flex items-center h-9 sm:h-12 p-3 bg-purple-100 dark:bg-dark-bg-secondary">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="mr-3 md:hidden text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary p-2"
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex-1 flex justify-center">
        <h1 className="text-base sm:text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 dark:from-dark-purple-glow dark:to-purple-400 bg-clip-text text-transparent">
          {pageTitle}
        </h1>
      </div>

      {/* Spacer to balance the menu button */}
      <div className="w-10 md:hidden"></div>
    </div>
  );
}
