'use client'

import React, { useState, useRef } from 'react'
import { IconUpload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'; // Import the useTranslation hook and i18n

interface DropzoneProps {
  onFilesAdded: (files: File[]) => void
}

const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    onFilesAdded(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      onFilesAdded(selectedFiles)
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-[var(--generalBorderRadius)] p-8 text-center cursor-pointer w-full mx-auto ${
        isDragActive ? 'border-[var(--sharedFilesDefaultColor)]' : 'border-gray-300'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        multiple
        className="hidden"
      />
      <IconUpload className="mx-auto text-4xl mb-4 text-gray-400" />
      <p className="text-gray-600" dir={isRTL ? 'rtl' : 'ltr'}>
        {isDragActive
          ? t('drop-the-files-here')
          : t('drag-and-drop-files-here-or-click-to-select-files')}
      </p>
    </div>
  );
}

export default Dropzone