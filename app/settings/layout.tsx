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
  User,
  Palette,
  History,
  Bot,
  Key,
  Paperclip,
  Mail,
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
} from "@/components/ui/sidebar";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsContentWrapper } from "@/components/settings/shared/settings-content-wrapper";

const settingsNavigation = [
  {
    name: "Account",
    href: "/settings/account",
    icon: User,
  },
  {
    name: "Customization",
    href: "/settings/customization",
    icon: Palette,
  },
  {
    name: "History & Sync",
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
  {
    name: "Contact Us",
    href: "/settings/contact",
    icon: Mail,
  },
];

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/chat");
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-purple-50 dark:bg-dark-bg">
        <Sidebar className="w-80 border-none bg-purple-100 dark:bg-dark-bg-secondary [&[data-mobile=true]]:bg-purple-100 [&[data-mobile=true]]:dark:bg-dark-bg-secondary">
          <SidebarHeader className="border-b border-purple-200 dark:border-dark-purple-accent p-6">
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/chat")}
                className="text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>

              <div className="flex items-center gap-2">
                {mounted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                    className="text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary"
                  >
                    <Sun className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-200 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>

            {/* User Profile */}
            {user && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.imageUrl} />
                    <AvatarFallback className="bg-purple-600 text-white font-semibold">
                      {user.firstName?.charAt(0) ||
                        user.emailAddresses[0]?.emailAddress.charAt(0) ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-purple-900 dark:text-purple-100 truncate">
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

                {/* Simplified Usage Stats */}
                <div className="bg-purple-50 dark:bg-dark-bg rounded-lg p-3 border border-purple-200 dark:border-dark-purple-accent">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      0/20 messages
                    </span>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      Resets daily
                    </span>
                  </div>
                  <div className="w-full bg-purple-200 dark:bg-dark-bg-tertiary rounded-full h-1.5">
                    <div
                      className="bg-purple-600 h-1.5 rounded-full"
                      style={{ width: "0%" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="p-6">
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
                          className={`w-full justify-start gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive
                              ? "bg-purple-200 dark:bg-dark-bg-tertiary text-purple-900 dark:text-purple-200"
                              : "text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-dark-bg-tertiary hover:text-purple-900 dark:hover:text-purple-200"
                          }`}
                        >
                          <button
                            onClick={() => router.push(item.href)}
                            className="w-full flex items-center gap-3"
                          >
                            <Icon className="h-5 w-5" />
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
        </Sidebar>

        <SidebarInset className="flex flex-col !bg-transparent h-screen overflow-hidden">
          <SettingsHeader />
          <SettingsContentWrapper>{children}</SettingsContentWrapper>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
