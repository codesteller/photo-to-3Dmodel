'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
  models: Array<{
    id: string
    name: string
    status: string
    inputPhotosCount?: number
    _count: {
      photoUploads: number
    }
  }>
  _count: {
    models: number
  }
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingProject, setDeletingProject] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetchProjects()
      
      // Auto-refresh every 5 seconds if there are processing models
      const interval = setInterval(() => {
        const hasProcessing = projects.some(p => 
          p.models.some(m => m.status === 'processing')
        )
        if (hasProcessing) {
          fetchProjects()
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [session, projects])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'processing':
        return '⚡'
      case 'failed':
        return '❌'
      default:
        return '⏳'
    }
  }

  const deleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will permanently delete all models, photos, and exports associated with this project. This action cannot be undone.`)) {
      return
    }

    setDeletingProject(projectId)
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Project "${projectName}" deleted successfully! Removed ${result.deletedFilesCount} files from storage.`)
        
        // Remove the project from the local state
        setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId))
      } else {
        const error = await response.json()
        alert(`Failed to delete project: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Error deleting project. Please try again.')
    } finally {
      setDeletingProject(null)
    }
  }

  const totalModels = projects.reduce((sum, project) => sum + project._count.models, 0)
  const processingModels = projects.reduce((sum, project) => 
    sum + project.models.filter(m => m.status === 'processing').length, 0)
  const completedModels = projects.reduce((sum, project) => 
    sum + project.models.filter(m => m.status === 'completed').length, 0)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">Photo to 3D</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  Welcome, {session?.user?.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your 3D Projects
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Create amazing 3D models from your photos
              </p>
              
              <div className="space-x-4">
                <Link
                  href="/upload"
                  className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  + New Project
                </Link>
                <button
                  onClick={() => {
                    setLoading(true)
                    fetchProjects()
                  }}
                  className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-lg text-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Project Grid */}
            <div className="mt-12">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Recent Projects
                  </h3>
                  {loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-500 mt-4">Loading projects...</p>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">📦</div>
                      <p className="text-gray-500 mb-4">No projects yet</p>
                      <p className="text-gray-400 text-sm">
                        Create your first 3D model by uploading photos
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((project) => (
                        <div key={project.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-medium text-gray-900 truncate pr-2">
                              {project.name}
                            </h4>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <span className="text-sm text-gray-500">
                                {project._count.models} model{project._count.models !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => deleteProject(project.id, project.name)}
                                disabled={deletingProject === project.id}
                                className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded-md hover:bg-red-50 transition-colors"
                                title="Delete project"
                              >
                                {deletingProject === project.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  '🗑️'
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {project.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          
                          <div className="space-y-2">
                            {project.models.map((model) => (
                              <div key={model.id} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700 truncate">{model.name}</span>
                                <div className="flex items-center space-x-2">
                                  {model.inputPhotosCount && (
                                    <span className="text-gray-500">{model.inputPhotosCount} photos</span>
                                  )}
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(model.status)} flex items-center space-x-1`}>
                                    <span>{getStatusIcon(model.status)}</span>
                                    <span>{model.status}</span>
                                    {model.status === 'processing' && (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 ml-1"></div>
                                    )}
                                  </span>
                                  {model.status === 'completed' && (
                                    <Link
                                      href={`/models/${model.id}`}
                                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                    >
                                      View →
                                    </Link>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Created {new Date(project.createdAt).toLocaleDateString()} at {new Date(project.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">📊</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Models
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">{totalModels}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">⚡</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Processing
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">{processingModels}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">✅</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Completed
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">{completedModels}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}