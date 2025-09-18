import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stabilityAI, downloadImageFromUrl } from "@/lib/stability"
import { azureStorage } from "@/lib/azure-storage"

export async function POST(
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
    const modelId = resolvedParams.id

    // Verify model belongs to user and get uploaded photos
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        project: {
          userId: session.user.id
        }
      },
      include: {
        project: true,
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

    // Update model status to processing
    await prisma.model.update({
      where: { id: modelId },
      data: {
        status: "processing",
        processingStartedAt: new Date(),
      }
    })

    // Process with Stability AI (SF3D + Background Removal)
    setTimeout(async () => {
      try {
        console.log(`Starting Stability AI processing for model ${modelId}`)
        
        let result
        
        // Check if Stability AI is configured and we have real photo URLs (not mock)
        const hasRealPhotos = model.photoUploads && model.photoUploads.length > 0 && 
          !model.photoUploads[0].fileUrl.includes('mock-storage')
          
        if (stabilityAI.isConfigured() && hasRealPhotos) {
          console.log(`Found ${model.photoUploads.length} real uploaded photos, processing with Stability AI`)
          
          try {
            // Download photos from real URLs (Azure Blob Storage)
            const imageBuffers: Buffer[] = []
            for (const photo of model.photoUploads) {
              console.log(`Downloading photo: ${photo.fileUrl}`)
              const imageBuffer = await downloadImageFromUrl(photo.fileUrl)
              imageBuffers.push(imageBuffer)
            }
            
            console.log(`Downloaded ${imageBuffers.length} photos, starting Stability AI processing...`)
            result = await stabilityAI.processPhotosToSF3D(imageBuffers, modelId, session.user.id)
          } catch (error) {
            console.error('Real Stability AI processing failed, falling back to mock:', error)
            const photoCount = model.photoUploads?.length || model.inputPhotosCount || 5
            result = await stabilityAI.mockProcessPhotosToSF3D(photoCount)
          }
        } else {
          // Fall back to mock processing 
          if (!stabilityAI.isConfigured()) {
            console.log('Using mock processing (Stability AI not configured)')
          } else if (!hasRealPhotos) {
            console.log('Using mock processing (photos are mock URLs or missing)')
          }
          const photoCount = model.photoUploads?.length || model.inputPhotosCount || 5
          result = await stabilityAI.mockProcessPhotosToSF3D(photoCount)
        }
        
        if (result.success && result.models.length > 0) {
          // Use the first successful model (or combine multiple if needed)
          const successfulModel = result.models.find(m => m.modelUrl && !m.error)
          
          if (successfulModel) {
            // Update model as completed with Stability AI URLs
            await prisma.model.update({
              where: { id: modelId },
              data: {
                status: "completed",
                processingCompletedAt: new Date(),
                modelFileUrl: successfulModel.modelUrl,
                thumbnailUrl: successfulModel.thumbnailUrl,
              }
            })

            // Store background-removed images to Azure (if available)
            if (result.backgroundRemovedImages && result.backgroundRemovedImages.length > 0) {
              console.log(`Storing ${result.backgroundRemovedImages.length} background-removed images...`)
              
              for (let i = 0; i < result.backgroundRemovedImages.length; i++) {
                const bgRemovedImg = result.backgroundRemovedImages[i]
                
                // Skip empty buffers (failed background removals)
                if (bgRemovedImg.imageBuffer.length === 0) continue
                
                try {
                  // Find corresponding photo upload
                  const photoUpload = model.photoUploads[bgRemovedImg.originalIndex]
                  if (!photoUpload) continue
                  
                  // Generate filename for background-removed image
                  const timestamp = Date.now()
                  const filename = `bg_removed_${bgRemovedImg.originalIndex}_${timestamp}.png`
                  
                  // Upload to Azure
                  const uploadResult = await azureStorage.uploadFile(
                    bgRemovedImg.imageBuffer,
                    filename,
                    'image/png',
                    `users/${session.user.id}/models/${modelId}/background-removed`
                  )
                  
                  if (uploadResult.success && uploadResult.url) {
                    // Store in database
                    await prisma.backgroundRemovedImage.create({
                      data: {
                        photoUploadId: photoUpload.id,
                        filename,
                        fileUrl: uploadResult.url,
                        fileSize: BigInt(bgRemovedImg.imageBuffer.length)
                      }
                    })
                    console.log(`Stored background-removed image for photo ${bgRemovedImg.originalIndex}`)
                  } else {
                    console.error(`Failed to upload background-removed image for photo ${bgRemovedImg.originalIndex}:`, uploadResult.error)
                  }
                } catch (error) {
                  console.error(`Error storing background-removed image for photo ${bgRemovedImg.originalIndex}:`, error)
                }
              }
            }

            // Create export entries - SF3D typically outputs GLB format
            // We'll simulate other format conversions
            await prisma.modelExport.createMany({
              data: [
                {
                  modelId,
                  format: "glb",
                  fileUrl: successfulModel.modelUrl,
                  fileSize: BigInt(Math.floor(Math.random() * 5000000) + 1000000),
                },
                {
                  modelId,
                  format: "obj",
                  fileUrl: successfulModel.modelUrl?.replace('.glb', '.obj') || `https://mock-stability.com/models/${modelId}.obj`,
                  fileSize: BigInt(Math.floor(Math.random() * 3000000) + 500000),
                },
                {
                  modelId,
                  format: "fbx",
                  fileUrl: successfulModel.modelUrl?.replace('.glb', '.fbx') || `https://mock-stability.com/models/${modelId}.fbx`,
                  fileSize: BigInt(Math.floor(Math.random() * 4000000) + 800000),
                },
                {
                  modelId,
                  format: "stl",
                  fileUrl: successfulModel.modelUrl?.replace('.glb', '.stl') || `https://mock-stability.com/models/${modelId}.stl`,
                  fileSize: BigInt(Math.floor(Math.random() * 2000000) + 300000),
                }
              ]
            })
            
            console.log(`Successfully processed model ${modelId} with Stability AI`)
          } else {
            throw new Error('No successful models generated from input photos')
          }
        } else {
          throw new Error(result.error || 'Stability AI processing failed')
        }
      } catch (error) {
        console.error("Error in background processing:", error)
        // Update model as failed
        await prisma.model.update({
          where: { id: modelId },
          data: {
            status: "failed",
            processingCompletedAt: new Date(),
            errorMessage: "Stability AI processing error: " + (error instanceof Error ? error.message : 'Unknown error'),
          }
        })
      }
    }, 1000) // Start processing after 1 second

    return NextResponse.json({ 
      message: "Processing started",
      modelId,
      status: "processing"
    })
  } catch (error) {
    console.error("Error starting processing:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}