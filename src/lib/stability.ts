// Stability AI API integration for background removal and 3D reconstruction

interface StabilityConfig {
  apiKey: string
  baseUrl: string
}

interface BackgroundRemovalResponse {
  success: boolean
  imageBase64?: string
  error?: string
}

interface SF3DResponse {
  success: boolean
  modelUrl?: string
  thumbnailUrl?: string
  error?: string
}

class StabilityAI {
  private config: StabilityConfig

  constructor() {
    this.config = {
      apiKey: process.env.STABILITY_API_KEY || '',
      baseUrl: 'https://api.stability.ai'
    }
  }

  // Remove background from image buffer
  async removeBackground(imageBuffer: Buffer): Promise<BackgroundRemovalResponse> {
    try {
      if (!this.config.apiKey) {
        return { success: false, error: 'Stability API key not configured' }
      }

      const formData = new FormData()
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
      formData.append('image', blob, 'image.jpg')

      const response = await fetch(`${this.config.baseUrl}/v2beta/stable-image/edit/remove-background`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'image/*'
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Background removal failed: ${response.statusText}`)
      }

      const responseBuffer = await response.arrayBuffer()
      const base64Image = Buffer.from(responseBuffer).toString('base64')

      return {
        success: true,
        imageBase64: base64Image
      }
    } catch (error) {
      console.error('Background removal error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Generate 3D model using SF3D from image buffer
  async generateSF3D(imageBuffer: Buffer): Promise<SF3DResponse> {
    try {
      if (!this.config.apiKey) {
        return { success: false, error: 'Stability API key not configured' }
      }

      const formData = new FormData()
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
      formData.append('image', blob, 'image.jpg')

      // SF3D endpoint (2 credits per generation)
      const response = await fetch(`${this.config.baseUrl}/v2beta/3d/stable-fast-3d`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`3D generation failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        modelUrl: result.model_url,
        thumbnailUrl: result.thumbnail_url
      }
    } catch (error) {
      console.error('SF3D generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Process multiple images with background removal and 3D reconstruction
  async processPhotosToSF3D(
    imageBuffers: Buffer[],
    modelId?: string,
    userId?: string
  ): Promise<{
    success: boolean
    models: Array<{
      originalIndex: number
      modelUrl?: string
      thumbnailUrl?: string
      error?: string
    }>
    backgroundRemovedImages?: Array<{
      originalIndex: number
      imageBuffer: Buffer
      error?: string
    }>
    error?: string
  }> {
    try {
      // Step 1: Remove background from all photos first
      console.log(`Step 1: Removing backgrounds from ${imageBuffers.length} photos...`)
      const backgroundRemovedImages: Buffer[] = []
      const backgroundRemovedImagesWithIndex: Array<{ originalIndex: number; imageBuffer: Buffer; error?: string }> = []
      const processingErrors: Array<{ originalIndex: number; error: string }> = []

      for (let i = 0; i < imageBuffers.length; i++) {
        const imageBuffer = imageBuffers[i]
        
        console.log(`Removing background from image ${i + 1}/${imageBuffers.length}...`)
        const bgRemovalResult = await this.removeBackground(imageBuffer)
        
        if (!bgRemovalResult.success) {
          const error = `Background removal failed: ${bgRemovalResult.error}`
          processingErrors.push({
            originalIndex: i,
            error
          })
          backgroundRemovedImagesWithIndex.push({
            originalIndex: i,
            imageBuffer: Buffer.alloc(0), // Empty buffer for failed images
            error
          })
        } else {
          const processedImageBuffer = Buffer.from(bgRemovalResult.imageBase64!, 'base64')
          backgroundRemovedImages.push(processedImageBuffer)
          backgroundRemovedImagesWithIndex.push({
            originalIndex: i,
            imageBuffer: processedImageBuffer
          })
        }

        // Rate limiting: Wait 2 seconds between background removal requests
        if (i < imageBuffers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // If we have at least one successfully processed image, proceed with 3D generation
      if (backgroundRemovedImages.length === 0) {
        return {
          success: false,
          models: processingErrors.map(error => ({
            originalIndex: error.originalIndex,
            error: error.error
          })),
          backgroundRemovedImages: backgroundRemovedImagesWithIndex,
          error: 'Failed to remove background from any photos'
        }
      }

      // Step 2: Use the first successfully processed image to generate a single 3D model
      // Note: SF3D API currently works with single images, so we use the best processed image
      console.log(`Step 2: Generating 3D model from ${backgroundRemovedImages.length} background-removed photos...`)
      console.log(`Using the first successfully processed image for 3D generation...`)
      
      const sf3dResult = await this.generateSF3D(backgroundRemovedImages[0])
      
      if (!sf3dResult.success) {
        return {
          success: false,
          models: [{
            originalIndex: 0,
            error: `3D generation failed: ${sf3dResult.error}`
          }],
          backgroundRemovedImages: backgroundRemovedImagesWithIndex,
          error: '3D model generation failed after successful background removal'
        }
      }

      // Return a single successful model result
      const results = [{
        originalIndex: 0,
        modelUrl: sf3dResult.modelUrl,
        thumbnailUrl: sf3dResult.thumbnailUrl
      }]

      // Add any background removal errors as additional entries
      processingErrors.forEach(error => {
        results.push({
          originalIndex: error.originalIndex,
          error: error.error
        })
      })

      return {
        success: true,
        models: results,
        backgroundRemovedImages: backgroundRemovedImagesWithIndex
      }
    } catch (error) {
      console.error('Batch processing error:', error)
      return {
        success: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Mock implementation for development (when API key is not available)
  async mockProcessPhotosToSF3D(photoCount: number): Promise<{
    success: boolean
    models: Array<{
      originalIndex: number
      modelUrl?: string
      thumbnailUrl?: string
      error?: string
    }>
    backgroundRemovedImages?: Array<{
      originalIndex: number
      imageBuffer: Buffer
      error?: string
    }>
    error?: string
  }> {
    // Simulate Step 1: Background removal for all photos
    console.log(`Mock Step 1: Removing backgrounds from ${photoCount} photos...`)
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Simulate some background removal failures (10% failure rate)
    const backgroundRemovalErrors = []
    const mockBackgroundRemovedImages = []
    let successfulBackgroundRemovals = 0
    
    for (let i = 0; i < photoCount; i++) {
      if (Math.random() > 0.1) { // 90% success rate for background removal
        successfulBackgroundRemovals++
        // Create a mock background-removed image (small PNG buffer)
        const mockImageData = Buffer.from('mock-bg-removed-image-' + i + '-' + Date.now())
        mockBackgroundRemovedImages.push({
          originalIndex: i,
          imageBuffer: mockImageData
        })
      } else {
        backgroundRemovalErrors.push({
          originalIndex: i,
          error: 'Mock background removal failed for this image'
        })
        mockBackgroundRemovedImages.push({
          originalIndex: i,
          imageBuffer: Buffer.alloc(0),
          error: 'Mock background removal failed for this image'
        })
      }
    }
    
    // If no successful background removals, fail completely
    if (successfulBackgroundRemovals === 0) {
      return {
        success: false,
        models: backgroundRemovalErrors,
        backgroundRemovedImages: mockBackgroundRemovedImages,
        error: 'Mock processing failed - no backgrounds could be removed'
      }
    }
    
    // Simulate Step 2: 3D model generation from background-removed photos
    console.log(`Mock Step 2: Generating 3D model from ${successfulBackgroundRemovals} background-removed photos...`)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
    
    // 95% success rate for 3D generation
    const sf3dSuccess = Math.random() > 0.05
    
    if (!sf3dSuccess) {
      return {
        success: false,
        models: [{
          originalIndex: 0,
          error: 'Mock 3D generation failed after successful background removal'
        }, ...backgroundRemovalErrors],
        backgroundRemovedImages: mockBackgroundRemovedImages,
        error: 'Mock 3D model generation failed'
      }
    }

    // Return single successful 3D model plus any background removal errors
    const models = [{
      originalIndex: 0,
      modelUrl: `https://mock-stability.com/models/sf3d_combined.glb`,
      thumbnailUrl: `https://mock-stability.com/thumbnails/sf3d_combined.jpg`
    }]
    
    // Add background removal errors
    models.push(...backgroundRemovalErrors)

    return {
      success: true,
      models,
      backgroundRemovedImages: mockBackgroundRemovedImages
    }
  }

  // Check if Stability AI is properly configured
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.apiKey.length > 0)
  }
}

// Helper function to download image from URL with SAS token support
export async function downloadImageFromUrl(url: string): Promise<Buffer> {
  try {
    // Import azureStorage at runtime to avoid circular dependencies
    const { azureStorage } = await import('./azure-storage')
    
    // Check if this is an Azure blob URL that needs SAS token
    if (url.includes('.blob.core.windows.net/')) {
      try {
        // Extract blob path from URL
        const urlParts = url.split('/')
        const containerIndex = urlParts.findIndex(part => part === 'photo-to-3d-uploads')
        if (containerIndex !== -1) {
          const pathSegments = urlParts.slice(containerIndex + 1)
          const blobPath = pathSegments.join('/')
          
          // Generate SAS token URL
          const sasUrl = await azureStorage.generateDownloadUrl(blobPath, 60)
          if (sasUrl) {
            const response = await fetch(sasUrl)
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer()
              return Buffer.from(arrayBuffer)
            }
          }
        }
      } catch (sasError) {
        console.warn('Failed to use SAS token, trying original URL:', sasError)
      }
    }
    
    // Fallback to original URL
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('Error downloading image:', error)
    throw error
  }
}

export const stabilityAI = new StabilityAI()
export default StabilityAI