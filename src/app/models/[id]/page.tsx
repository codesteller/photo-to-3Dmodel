'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'

interface BackgroundRemovedImage {
  id: string
  filename: string
  fileUrl: string
  fileSize: string
  createdAt: string
}

function SecureImage({ fileUrl, alt, className, filename }: { 
  fileUrl: string; 
  alt: string; 
  className?: string; 
  filename: string;
}) {
  const [secureUrl, setSecureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const getUrl = async () => {
      try {
        // Extract the blob path from the URL
        const urlParts = fileUrl.split('/')
        const containerIndex = urlParts.findIndex(part => part === 'photo-to-3d-uploads')
        if (containerIndex === -1) {
          setSecureUrl(fileUrl)
          setLoading(false)
          return
        }
        
        const pathSegments = urlParts.slice(containerIndex + 1)
        const apiPath = pathSegments.join('/')
        
        // Get secure download URL from our API
        const response = await fetch(`/api/download/${apiPath}`)
        if (!response.ok) {
          throw new Error('Failed to get secure URL')
        }
        
        const { downloadUrl } = await response.json()
        setSecureUrl(downloadUrl)
      } catch (error) {
        console.error('Failed to get secure URL:', error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    getUrl()
  }, [fileUrl])

  if (loading) {
    return (
      <div className={`bg-gray-200 animate-pulse rounded-md flex items-center justify-center ${className}`}>
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !secureUrl) {
    return (
      <div className={`bg-gray-100 rounded-md flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-1">🖼️</div>
          <div className="text-xs">Image unavailable</div>
        </div>
      </div>
    )
  }

  return (
    <img 
      src={secureUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  )
}

interface PhotoUpload {
  id: string
  filename: string
  fileUrl: string
  fileSize: string
  uploadOrder: number
  backgroundRemovedImage: BackgroundRemovedImage | null
  createdAt: string
}

interface ModelExport {
  id: string
  format: string
  fileUrl: string
  fileSize: string // Changed from bigint to string to match API response
  createdAt: string
}

interface Model {
  id: string
  name: string
  status: string
  inputPhotosCount?: number
  processingStartedAt?: string
  processingCompletedAt?: string
  modelFileUrl?: string
  thumbnailUrl?: string
  errorMessage?: string
  project: {
    id: string
    name: string
    description?: string
  }
  photoUploads: PhotoUpload[]
  modelExports: ModelExport[]
}

export default function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [model, setModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    fetchModel()
  }, [resolvedParams.id])

  const fetchModel = async () => {
    try {
      const response = await fetch(`/api/models/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setModel(data.model)
      } else if (response.status === 404) {
        setError('Model not found')
      } else {
        setError('Failed to load model')
      }
    } catch (error) {
      console.error('Error fetching model:', error)
      setError('Failed to load model')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: string) => {
    const size = Number(bytes)
    if (size === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(size) / Math.log(k))
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleSecureDownload = async (fileUrl: string, filename: string) => {
    try {
      // Extract the blob path from the URL
      const urlParts = fileUrl.split('/')
      const containerIndex = urlParts.findIndex(part => part === 'photo-to-3d-uploads')
      if (containerIndex === -1) {
        throw new Error('Invalid file URL')
      }
      
      const pathSegments = urlParts.slice(containerIndex + 1)
      const apiPath = pathSegments.join('/')
      
      // Get secure download URL from our API
      const response = await fetch(`/api/download/${apiPath}`)
      if (!response.ok) {
        throw new Error('Failed to get download URL')
      }
      
      const { downloadUrl } = await response.json()
      
      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. Please try again.')
    }
  }

  const getSecureImageUrl = async (fileUrl: string) => {
    try {
      // Extract the blob path from the URL
      const urlParts = fileUrl.split('/')
      const containerIndex = urlParts.findIndex(part => part === 'photo-to-3d-uploads')
      if (containerIndex === -1) {
        return fileUrl // Return original URL if can't parse
      }
      
      const pathSegments = urlParts.slice(containerIndex + 1)
      const apiPath = pathSegments.join('/')
      
      // Get secure download URL from our API
      const response = await fetch(`/api/download/${apiPath}`)
      if (!response.ok) {
        return fileUrl // Return original URL on error
      }
      
      const { downloadUrl } = await response.json()
      return downloadUrl
    } catch (error) {
      console.error('Failed to get secure URL:', error)
      return fileUrl // Return original URL on error
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !model) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {error || 'Model not found'}
            </h2>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-500"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-500">
                  ← Back to Dashboard
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">3D Model Viewer</h1>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{model.name}</h2>
                  <p className="text-gray-600 mt-1">
                    Project: {model.project.name}
                  </p>
                  {model.project.description && (
                    <p className="text-gray-500 text-sm mt-1">{model.project.description}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(model.status)}`}>
                  {model.status}
                </span>
              </div>
            </div>

            {/* Model Display */}
            <div className="p-6">
              {model.status === 'completed' ? (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* 3D Model Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">3D Model Preview</h3>
                    <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🔮</div>
                        <p className="text-gray-600">3D Model Viewer</p>
                        <p className="text-gray-500 text-sm mt-2">
                          Interactive 3D viewer coming soon
                        </p>
                        {model.modelFileUrl && (
                          <a
                            href={model.modelFileUrl}
                            className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Raw Model File →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Background-Removed Images */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Background-Removed Images</h3>
                    {model.photoUploads.some(photo => photo.backgroundRemovedImage) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {model.photoUploads.map((photo, index) => 
                          photo.backgroundRemovedImage ? (
                            <div key={photo.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="aspect-square bg-white rounded-md mb-2 flex items-center justify-center">
                                <SecureImage
                                  fileUrl={photo.backgroundRemovedImage.fileUrl}
                                  alt={`Background removed ${index + 1}`}
                                  className="max-w-full max-h-full object-contain rounded-md"
                                  filename={photo.backgroundRemovedImage.filename}
                                />
                              </div>
                              <p className="text-xs text-gray-600 text-center mb-2">{formatFileSize(photo.backgroundRemovedImage.fileSize)}</p>
                              <button
                                onClick={() => handleSecureDownload(photo.backgroundRemovedImage!.fileUrl, photo.backgroundRemovedImage!.filename)}
                                className="w-full bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
                              >
                                📥 Download
                              </button>
                            </div>
                          ) : null
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <div className="text-gray-400 text-4xl mb-2">🖼️</div>
                        <p className="text-gray-600">No background-removed images available</p>
                        <p className="text-gray-500 text-sm mt-1">
                          Images with removed backgrounds will appear here after processing
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Download Options */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">3D Model Downloads</h3>
                    <div className="space-y-3">
                      {model.modelExports.map((exportFile) => (
                        <div key={exportFile.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium text-gray-900 uppercase">
                                {exportFile.format}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {formatFileSize(exportFile.fileSize)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleSecureDownload(exportFile.fileUrl, `model.${exportFile.format.toLowerCase()}`)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Model Information */}
                    <div className="mt-8 bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Model Information</h4>
                      <div className="space-y-2 text-sm">
                        {model.inputPhotosCount && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Input Photos:</span>
                            <span className="text-gray-900">{model.inputPhotosCount}</span>
                          </div>
                        )}
                        {model.processingStartedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Processing Started:</span>
                            <span className="text-gray-900">
                              {new Date(model.processingStartedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {model.processingCompletedAt && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Completed:</span>
                            <span className="text-gray-900">
                              {new Date(model.processingCompletedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Processing Engine:</span>
                          <span className="text-gray-900">Stability AI SF3D</span>
                        </div>
                        {model.status === 'completed' && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Features:</span>
                              <span className="text-gray-900">Background Removal + 3D Reconstruction</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Background-Removed Images:</span>
                              <span className="text-gray-900">
                                {model.photoUploads.filter(photo => photo.backgroundRemovedImage).length} / {model.photoUploads.length}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : model.status === 'processing' ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                  <h3 className="text-lg font-medium text-gray-900 mt-4">Processing Your 3D Model</h3>
                  <p className="text-gray-600 mt-2">
                    Using Stability AI SF3D to remove backgrounds and generate your 3D model
                  </p>
                  {model.processingStartedAt && (
                    <p className="text-gray-500 text-sm mt-2">
                      Started: {new Date(model.processingStartedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : model.status === 'failed' ? (
                <div className="text-center py-12">
                  <div className="text-red-400 text-6xl mb-4">❌</div>
                  <h3 className="text-lg font-medium text-gray-900">Processing Failed</h3>
                  <p className="text-gray-600 mt-2">
                    {model.errorMessage || 'An error occurred while processing your 3D model'}
                  </p>
                  <button
                    onClick={() => router.push('/upload')}
                    className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">⏳</div>
                  <h3 className="text-lg font-medium text-gray-900">Pending Processing</h3>
                  <p className="text-gray-600 mt-2">
                    Your 3D model is queued for processing
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}