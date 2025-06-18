import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Palette,
  History,
  Bot,
  Key,
  Paperclip,
  Mail,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const settingsCategories = [
  {
    name: "Account",
    href: "/settings/account",
    icon: User,
    description: "Manage your profile, billing, and subscription",
    badge: null,
  },
  {
    name: "Customization",
    href: "/settings/customization",
    icon: Palette,
    description: "Personalize your chat experience and appearance",
    badge: null,
  },
  {
    name: "History & Sync",
    href: "/settings/history",
    icon: History,
    description: "Manage chat history and sync across devices",
    badge: null,
  },
  {
    name: "Models",
    href: "/settings/models",
    icon: Bot,
    description: "Configure AI models and their settings",
    badge: null,
  },
  {
    name: "API Keys",
    href: "/settings/api-keys",
    icon: Key,
    description: "Bring your own API keys for AI providers",
    badge: "BYOK",
  },
  {
    name: "Attachments",
    href: "/settings/attachments",
    icon: Paperclip,
    description: "File upload settings and attachment preferences",
    badge: null,
  },
  {
    name: "Contact Us",
    href: "/settings/contact",
    icon: Mail,
    description: "Get help and provide feedback",
    badge: null,
  },
];

export default function SettingsPage() {
  return (
    <SettingsPageWrapper
      title="Settings"
      description="Manage your account, preferences, and integrations"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {settingsCategories.map((category) => {
          const Icon = category.icon;

          return (
            <Link key={category.name} href={category.href}>
              <div className="h-full p-6 transition-colors hover:bg-purple-100 dark:hover:bg-dark-bg-tertiary cursor-pointer">
                <div className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                        <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                        {category.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {category.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {category.badge}
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-purple-400 dark:text-purple-500" />
                    </div>
                  </div>
                </div>
                <div className="pt-0">
                  <p className="text-purple-700 dark:text-purple-300">
                    {category.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SettingsPageWrapper>
  );
}
