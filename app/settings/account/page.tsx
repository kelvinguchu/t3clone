import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";

export default function Page() {
  return (
    <SettingsPageWrapper
      title="Account"
      description="Manage your profile, billing, and subscription"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          Account settings coming soon...
        </p>
      </div>
    </SettingsPageWrapper>
  );
}
