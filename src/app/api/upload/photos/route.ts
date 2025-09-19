import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { azureStorage } from "@/lib/azure-storage"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const modelId = formData.get('modelId') as string
    
    if (!modelId) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      )
    }

    // Verify model belongs to user
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        project: {
          userId: session.user.id
        }
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      )
    }

    // Extract photos from form data
    const photos: Array<{ buffer: Buffer; originalName: string; mimeType: string }> = []
    
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo_') && value instanceof File) {
        const arrayBuffer = await value.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Validate file type
        if (!value.type.startsWith('image/')) {
          return NextResponse.json(
            { error: `Invalid file type: ${value.type}` },
            { status: 400 }
          )
        }

        photos.push({
          buffer,
          originalName: value.name,
          mimeType: value.type
        })
      }
    }

    if (photos.length === 0) {
      return NextResponse.json(
        { error: "No photos provided" },
        { status: 400 }
      )
    }

    if (photos.length < 5) {
      return NextResponse.json(
        { error: "Minimum 5 photos required" },
        { status: 400 }
      )
    }

    if (photos.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 photos allowed" },
        { status: 400 }
      )
    }

    // Check if Azure Storage is configured
    if (!azureStorage.isConfigured()) {
      // Fallback: Save photos info without actual file upload (for development)
      console.warn('Azure Blob Storage not configured - saving photo metadata only')
      
      const photoUploads = await Promise.all(
        photos.map(async (photo, index) => {
          return await prisma.photoUpload.create({
            data: {
              modelId,
              filename: photo.originalName,
              fileUrl: `https://mock-storage.azure.com/users/${session.user.id}/models/${modelId}/photos/${photo.originalName}`,
              fileSize: BigInt(photo.buffer.length),
              uploadOrder: index
            }
          })
        })
      )

      // Convert BigInt to string for JSON serialization
      const photoUploadsForJson = photoUploads.map(photo => ({
        ...photo,
        fileSize: photo.fileSize?.toString()
      }))

      return NextResponse.json({
        message: "Photos uploaded successfully (mock mode)",
        uploadedCount: photos.length,
        photos: photoUploadsForJson
      })
    }

    console.log(`Starting Azure upload for ${photos.length} photos to model ${modelId}`)
    
    // Upload photos to Azure Blob Storage
    const uploadResult = await azureStorage.uploadPhotos(
      photos,
      modelId,
      session.user.id
    )
    
    console.log(`Azure upload result:`, {
      success: uploadResult.success,
      uploadedCount: uploadResult.uploadedFiles.length,
      errorCount: uploadResult.errors.length,
      errors: uploadResult.errors
    })

    if (!uploadResult.success) {
      return NextResponse.json(
        { 
          error: "Photo upload failed",
          details: uploadResult.errors
        },
        { status: 500 }
      )
    }

    // Save photo upload records to database
    const photoUploads = await Promise.all(
      uploadResult.uploadedFiles.map(async (file, index) => {
        return await prisma.photoUpload.create({
          data: {
            modelId,
            filename: file.originalName,
            fileUrl: file.url,
            fileSize: BigInt(file.size),
            uploadOrder: index
          }
        })
      })
    )

    // Update model with actual photo count
    await prisma.model.update({
      where: { id: modelId },
      data: {
        inputPhotosCount: uploadResult.uploadedFiles.length
      }
    })

    // Convert BigInt to string for JSON serialization
    const photoUploadsForJson = photoUploads.map(photo => ({
      ...photo,
      fileSize: photo.fileSize?.toString()
    }))

    return NextResponse.json({
      message: "Photos uploaded successfully",
      uploadedCount: uploadResult.uploadedFiles.length,
      photos: photoUploadsForJson,
      errors: uploadResult.errors.length > 0 ? uploadResult.errors : undefined
    })

  } catch (error) {
    console.error("Photo upload error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Get uploaded photos for a model
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json(
        { error: "Model ID is required" },
        { status: 400 }
      )
    }

    // Verify model belongs to user and get photos
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        project: {
          userId: session.user.id
        }
      },
      include: {
        photoUploads: {
          orderBy: {
            uploadOrder: 'asc'
          }
        }
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      )
    }

    // Convert BigInt to string for JSON serialization
    const photoUploadsForJson = model.photoUploads.map(photo => ({
      ...photo,
      fileSize: photo.fileSize?.toString()
    }))

    return NextResponse.json({
      modelId,
      photos: photoUploadsForJson,
      totalCount: model.photoUploads.length
    })

  } catch (error) {
    console.error("Get photos error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}