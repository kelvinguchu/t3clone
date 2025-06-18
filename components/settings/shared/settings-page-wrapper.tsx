'use client'

import { ReactNode } from 'react'

interface SettingsPageWrapperProps {
  children: ReactNode
  title: string
  description?: string
  className?: string
}

export function SettingsPageWrapper({
  children,
  title,
  description,
  className = '',
}: SettingsPageWrapperProps) {
  return (
    <div className={`space-y-6  ${className}`}>
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="text-gray-600 dark:text-slate-400 text-sm">
            {description}
          </p>
        )}
      </div>
      
      {/* Page Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  )
} 