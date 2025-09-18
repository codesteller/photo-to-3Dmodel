'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import PhotoUploader from '@/components/upload/PhotoUploader'
import Link from 'next/link'

export default function UploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const handleCreateProject = async () => {
    if (selectedFiles.length < 5) {
      alert('Please select at least 5 photos')
      return
    }

    if (!projectName.trim()) {
      alert('Please enter a project name')
      return
    }

    setIsUploading(true)

    try {
      // Create project
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
        }),
      })

      if (!projectResponse.ok) {
        throw new Error('Failed to create project')
      }

      const { project } = await projectResponse.json()

      // Create model for the project
      const modelResponse = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          name: `${projectName} Model`,
          photoCount: selectedFiles.length,
        }),
      })

      if (!modelResponse.ok) {
        throw new Error('Failed to create model')
      }

      const { model } = await modelResponse.json()

      // Upload photos to Azure Blob Storage
      const formData = new FormData()
      formData.append('modelId', model.id)
      
      selectedFiles.forEach((file, index) => {
        formData.append(`photo_${index}`, file)
      })

      const uploadResponse = await fetch('/api/upload/photos', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload photos')
      }

      const uploadResult = await uploadResponse.json()
      console.log('Photos uploaded:', uploadResult)

      // Start processing the model
      const processResponse = await fetch(`/api/models/${model.id}/process`, {
        method: 'POST',
      })

      if (!processResponse.ok) {
        console.warn('Failed to start processing, but project was created')
      }

      alert(`Project "${projectName}" created successfully! Photos uploaded to Azure and 3D processing has started.`)
      router.push('/dashboard')
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Error creating project. Please try again.')
    } finally {
      setIsUploading(false)
    }
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
                <h1 className="text-xl font-semibold text-gray-900">New Project</h1>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Create 3D Model from Photos
            </h2>

            {/* Project Details */}
            <div className="mb-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="project-name" className="block text-sm font-medium text-gray-700">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="My 3D Model"
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-gray-700">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description of your model"
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="mb-8">
              <PhotoUploader
                onFilesSelected={setSelectedFiles}
                maxFiles={8}
                isUploading={isUploading}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <Link
                href="/dashboard"
                className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
              <button
                onClick={handleCreateProject}
                disabled={selectedFiles.length < 5 || !projectName.trim() || isUploading}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Creating...
                  </div>
                ) : (
                  'Create 3D Model'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}