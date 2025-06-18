import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";

export default function Page() {
  return (
    <SettingsPageWrapper
      title="Customization"
      description="Personalize your chat experience and appearance"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          Customization settings coming soon...
        </p>
      </div>
    </SettingsPageWrapper>
  );
}
