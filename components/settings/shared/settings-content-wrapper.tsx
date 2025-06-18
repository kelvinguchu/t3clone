import { ReactNode } from "react";

interface SettingsContentWrapperProps {
  children: ReactNode;
}

export function SettingsContentWrapper({
  children,
}: SettingsContentWrapperProps) {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-purple-50 dark:bg-dark-bg duration-1000 transition-all relative border-2 border-purple-200 dark:border-dark-purple-accent border-t-purple-200 dark:border-t-dark-purple-accent rounded-t-[1rem]">
      <div className="flex-1 overflow-y-auto min-h-0 p-8">{children}</div>
    </div>
  );
}
