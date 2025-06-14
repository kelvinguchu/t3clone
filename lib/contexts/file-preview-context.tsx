'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface FilePreviewData {
  id: string
  name: string
  contentType: string
  url: string
  size: number
  isUploading?: boolean
}

interface FilePreviewContextType {
  // Store preview URLs by file ID for quick access
  previewUrls: Map<string, string>
  // Store complete file data for components that need it
  fileData: Map<string, FilePreviewData>
  // Add a file preview (called during upload)
  addFilePreview: (file: FilePreviewData) => void
  // Update file preview when upload completes
  updateFilePreview: (id: string, updates: Partial<FilePreviewData>) => void
  // Get preview URL by file ID
  getPreviewUrl: (id: string) => string | undefined
  // Get complete file data by ID
  getFileData: (id: string) => FilePreviewData | undefined
  // Remove file preview (cleanup)
  removeFilePreview: (id: string) => void
  // Batch add multiple files
  addMultipleFiles: (files: FilePreviewData[]) => void
}

const FilePreviewContext = createContext<FilePreviewContextType | undefined>(undefined)

export function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map())
  const [fileData, setFileData] = useState<Map<string, FilePreviewData>>(new Map())

  const addFilePreview = useCallback((file: FilePreviewData) => {
    setPreviewUrls(prev => new Map(prev).set(file.id, file.url))
    setFileData(prev => new Map(prev).set(file.id, file))
  }, [])

  const updateFilePreview = useCallback((id: string, updates: Partial<FilePreviewData>) => {
    setFileData(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(id)
      if (existing) {
        const updated = { ...existing, ...updates }
        newMap.set(id, updated)
        
        // Update preview URL if URL changed
        if (updates.url) {
          setPreviewUrls(urlMap => new Map(urlMap).set(id, updates.url!))
        }
      }
      return newMap
    })
  }, [])

  const getPreviewUrl = useCallback((id: string) => {
    return previewUrls.get(id)
  }, [previewUrls])

  const getFileData = useCallback((id: string) => {
    return fileData.get(id)
  }, [fileData])

  const removeFilePreview = useCallback((id: string) => {
    setPreviewUrls(prev => {
      const newMap = new Map(prev)
      const url = newMap.get(id)
      // Clean up blob URLs to prevent memory leaks
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
      newMap.delete(id)
      return newMap
    })
    
    setFileData(prev => {
      const newMap = new Map(prev)
      newMap.delete(id)
      return newMap
    })
  }, [])

  const addMultipleFiles = useCallback((files: FilePreviewData[]) => {
    setPreviewUrls(prev => {
      const newMap = new Map(prev)
      files.forEach(file => newMap.set(file.id, file.url))
      return newMap
    })
    
    setFileData(prev => {
      const newMap = new Map(prev)
      files.forEach(file => newMap.set(file.id, file))
      return newMap
    })
  }, [])

  const value: FilePreviewContextType = {
    previewUrls,
    fileData,
    addFilePreview,
    updateFilePreview,
    getPreviewUrl,
    getFileData,
    removeFilePreview,
    addMultipleFiles,
  }

  return (
    <FilePreviewContext.Provider value={value}>
      {children}
    </FilePreviewContext.Provider>
  )
}

export function useFilePreview() {
  const context = useContext(FilePreviewContext)
  if (context === undefined) {
    throw new Error('useFilePreview must be used within a FilePreviewProvider')
  }
  return context
} 