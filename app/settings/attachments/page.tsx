import { SettingsPageWrapper } from "@/components/settings/shared/settings-page-wrapper";

export default function Page() {
  return (
    <SettingsPageWrapper
      title="Attachments"
      description="File upload settings and attachment preferences"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-400">
          Attachment settings coming soon...
        </p>
      </div>
    </SettingsPageWrapper>
  );
} 