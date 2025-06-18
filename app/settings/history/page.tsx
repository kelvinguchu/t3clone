import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";

export default function Page() {
  return (
    <SettingsPageWrapper
      title="History & Sync"
      description="Manage chat history and sync across devices"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          History and sync settings coming soon...
        </p>
      </div>
    </SettingsPageWrapper>
  );
}
