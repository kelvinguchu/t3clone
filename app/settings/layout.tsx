"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sun,
  LogOut,
  Bot,
  Key,
  Paperclip,
  History,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsContentWrapper } from "@/components/settings/shared/settings-content-wrapper";
import { usePlanLimits } from "@/lib/hooks/use-plan-limits";

const settingsNavigation = [
  // {
  //   name: "Account",
  //   href: "/settings/account",
  //   icon: User,
  // },
  // {
  //   name: "Customization",
  //   href: "/settings/customization",
  //   icon: Palette,
  // },
  {
    name: "History",
    href: "/settings/history",
    icon: History,
  },
  {
    name: "Models",
    href: "/settings/models",
    icon: Bot,
  },
  {
    name: "API Keys",
    href: "/settings/api-keys",
    icon: Key,
  },
  {
    name: "Attachments",
    href: "/settings/attachments",
    icon: Paperclip,
  },
  // {
  //   name: "Contact Us",
  //   href: "/settings/contact",
  //   icon: Mail,
  // },
];

interface SettingsLayoutProps {
  children: ReactNode;
}

function SettingsSidebarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { setTheme, resolvedTheme } = useTheme();
  const { setOpenMobile, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const planLimits = usePlanLimits();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/chat");
  };

  const handleNavigation = (href: string) => {
    if (isMobile) {
      setOpenMobile(false);
      // Small delay to allow the close animation to start before navigation
      setTimeout(() => {
        router.push(href);
      }, 150);
    } else {
      router.push(href);
    }
  };

  const handleBackToChat = () => {
    if (isMobile) {
      setOpenMobile(false);
      // Small delay to allow the close animation to start before navigation
      setTimeout(() => {
        router.push("/chat");
      }, 150);
    } else {
      router.push("/chat");
    }
  };

  return (
    <Sidebar className="border-none bg-purple-100 dark:bg-dark-bg-secondary [&[data-mobile=true]]:bg-purple-100 [&[data-mobile=true]]:dark:bg-dark-bg-secondary md:block">
      <SidebarHeader className=" p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToChat}
            className="text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary text-sm cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Back to Chat</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        {/* User Profile */}
        {user && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 cursor-pointer">
                <AvatarImage src={user.imageUrl} />
                <AvatarFallback className="bg-purple-600 text-white font-semibold text-sm">
                  {user.firstName?.charAt(0) ||
                    user.emailAddresses[0]?.emailAddress.charAt(0) ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-purple-900 dark:text-purple-100 truncate text-sm sm:text-base">
                  {user.fullName || user.firstName || "User"}
                </h2>
                <Badge
                  variant="secondary"
                  className="mt-1 bg-purple-200 dark:bg-dark-bg-tertiary text-purple-800 dark:text-purple-200 text-xs"
                >
                  {(user.publicMetadata?.plan as string) || "Free Plan"}
                </Badge>
              </div>
            </div>

            {/* Dynamic Usage Stats */}
            <div className="bg-purple-50 dark:bg-dark-bg rounded-lg p-3 border border-purple-200 dark:border-dark-purple-accent">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-purple-800 dark:text-purple-200">
                  {planLimits.isLoading
                    ? "Loading..."
                    : planLimits.total === -1
                      ? `${planLimits.used} messages (unlimited)`
                      : `${planLimits.used}/${planLimits.total} messages`}
                </span>
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  {planLimits.plan === "pro"
                    ? "Resets monthly"
                    : "Resets daily"}
                </span>
              </div>
              <div className="w-full bg-purple-200 dark:bg-dark-bg-tertiary rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    planLimits.percentage >= 90
                      ? "bg-red-500"
                      : planLimits.percentage >= 70
                        ? "bg-orange-500"
                        : "bg-purple-600"
                  }`}
                  style={{
                    width:
                      planLimits.total === -1
                        ? "0%"
                        : `${Math.min(100, planLimits.percentage)}%`,
                  }}
                ></div>
              </div>
              {planLimits.error && (
                <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                  {planLimits.error}
                </div>
              )}
              {!planLimits.canSend && planLimits.total !== -1 && (
                <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                  {planLimits.plan === "pro"
                    ? "Monthly limit reached. Resets next month."
                    : "Daily limit reached. Resets at midnight."}
                </div>
              )}
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="p-4 sm:p-6">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`w-full justify-start gap-3 px-3 py-2 rounded-lg transition-colors text-sm sm:text-base cursor-pointer ${
                        isActive
                          ? "bg-purple-200 dark:bg-dark-bg-tertiary text-purple-900 dark:text-purple-200"
                          : "text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary hover:text-purple-900 dark:hover:text-purple-200"
                      }`}
                    >
                      <button
                        onClick={() => handleNavigation(item.href)}
                        className="w-full flex items-center gap-3 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="font-medium">{item.name}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 sm:p-6 space-y-2">
        {mounted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="w-full justify-start gap-3 text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary text-sm cursor-pointer"
          >
            <Sun className="h-4 w-4" />
            <span>Toggle theme</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary text-sm cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <SettingsSidebarContent />
      <SidebarInset className="flex flex-col h-screen overflow-hidden bg-purple-50 dark:bg-dark-bg">
        <SettingsHeader />
        <SettingsContentWrapper>{children}</SettingsContentWrapper>
      </SidebarInset>
    </SidebarProvider>
  );
}
