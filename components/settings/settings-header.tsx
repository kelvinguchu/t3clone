"use client";

import { usePathname } from "next/navigation";

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
      return "History & Sync";
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

  return (
    <div className="flex items-center justify-center h-6 p-2 bg-purple-100 dark:bg-dark-bg-secondary">
      <h1 className="text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-800 dark:from-dark-purple-glow dark:to-purple-400 bg-clip-text text-transparent">
        {pageTitle}
      </h1>
    </div>
  );
}
