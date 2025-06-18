import { ReactNode } from "react";

interface SettingsContentWrapperProps {
  children: ReactNode;
}

export function SettingsContentWrapper({
  children,
}: SettingsContentWrapperProps) {
  return (
    <div className="flex flex-col md:border-2 md:border-r-purple-200 md:border-l-purple-200 md:dark:border-l-dark-purple-accent md:border-t-purple-200 md:rounded-t-[1rem] md:dark:border-t-dark-purple-accent h-full min-h-0 bg-transparent duration-1000 transition-all relative">
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-8">
        {children}
      </div>
    </div>
  );
}
