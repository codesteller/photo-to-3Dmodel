import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { azureStorage } from "@/lib/azure-storage"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const projectId = resolvedParams.id

    // First, verify the project belongs to the user and get all related data
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id
      },
      include: {
        models: {
          include: {
            photoUploads: true,
            modelExports: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    // Collect all file URLs for deletion from Azure (if configured)
    const filesToDelete: string[] = []
    
    for (const model of project.models) {
      // Add photo upload URLs
      for (const photo of model.photoUploads) {
        if (photo.fileUrl && !photo.fileUrl.includes('mock-storage')) {
          filesToDelete.push(photo.fileUrl)
        }
      }
      
      // Add model file URLs
      if (model.modelFileUrl && !model.modelFileUrl.includes('mock-stability')) {
        filesToDelete.push(model.modelFileUrl)
      }
      
      // Add export file URLs
      for (const modelExport of model.modelExports) {
        if (modelExport.fileUrl && !modelExport.fileUrl.includes('mock-stability')) {
          filesToDelete.push(modelExport.fileUrl)
        }
      }
    }

    // Delete files from Azure Blob Storage (if configured and not mock URLs)
    if (azureStorage.isConfigured() && filesToDelete.length > 0) {
      console.log(`Deleting ${filesToDelete.length} files from Azure for project ${projectId}`)
      
      for (const fileUrl of filesToDelete) {
        try {
          // Extract blob name from URL
          // Format: https://account.blob.core.windows.net/container/blobname
          const url = new URL(fileUrl)
          const pathParts = url.pathname.split('/')
          const blobName = pathParts.slice(2).join('/') // Remove leading container name
          
          await azureStorage.deleteFile(blobName)
        } catch (error) {
          console.warn(`Failed to delete file ${fileUrl}:`, error)
          // Continue with deletion even if file deletion fails
        }
      }
    }

    // Delete the project (this will cascade delete all related data)
    await prisma.project.delete({
      where: {
        id: projectId
      }
    })

    return NextResponse.json({ 
      message: "Project deleted successfully",
      deletedFilesCount: filesToDelete.length
    })

  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Get a specific project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const projectId = resolvedParams.id

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id
      },
      include: {
        models: {
          include: {
            photoUploads: {
              orderBy: {
                uploadOrder: 'asc'
              }
            },
            modelExports: true,
            _count: {
              select: {
                photoUploads: true
              }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ project })

  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}