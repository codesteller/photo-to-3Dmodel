'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface PhotoUploaderProps {
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
  isUploading?: boolean
}

export default function PhotoUploader({ 
  onFilesSelected, 
  maxFiles = 8, 
  isUploading = false 
}: PhotoUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalFiles = selectedFiles.length + acceptedFiles.length
    
    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    const newFiles = [...selectedFiles, ...acceptedFiles]
    setSelectedFiles(newFiles)
    onFilesSelected(newFiles)
  }, [selectedFiles, onFilesSelected, maxFiles])

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    onFilesSelected(newFiles)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true,
    disabled: isUploading
  })

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="text-6xl mb-4">📸</div>
        {isDragActive ? (
          <p className="text-blue-600 text-lg">Drop the photos here...</p>
        ) : (
          <div>
            <p className="text-gray-600 text-lg mb-2">
              Drag & drop photos here, or click to browse
            </p>
            <p className="text-gray-500 text-sm">
              Upload 5-{maxFiles} high-quality photos from different angles
            </p>
            <p className="text-gray-400 text-xs mt-2">
              Supported formats: JPEG, PNG, WebP
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Selected Photos ({selectedFiles.length}/{maxFiles})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  ×
                </button>
                <p className="mt-2 text-xs text-gray-500 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>

          {/* Upload Requirements */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Tips for best results:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Take photos from all angles (front, back, sides, top)</li>
              <li>• Ensure good lighting and sharp focus</li>
              <li>• Include some overlapping areas between photos</li>
              <li>• Minimum 5 photos required, 6-8 recommended</li>
            </ul>
          </div>

          {selectedFiles.length >= 5 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                ✅ Ready to create 3D model! You have {selectedFiles.length} photos selected.
              </p>
              <p className="text-green-700 text-xs mt-1">
                🚀 Powered by Stability AI SF3D - automatic background removal + 3D reconstruction
              </p>
            </div>
          )}

          {selectedFiles.length < 5 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Need at least {5 - selectedFiles.length} more photos for 3D reconstruction
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}