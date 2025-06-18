import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";

export default function Page() {
  return (
    <SettingsPageWrapper
      title="Models"
      description="Configure AI models and their settings"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          Model configuration settings coming soon...
        </p>
      </div>
    </SettingsPageWrapper>
  );
} 