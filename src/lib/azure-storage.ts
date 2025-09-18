// Azure Blob Storage service for file uploads and management

import { BlobServiceClient, StorageSharedKeyCredential, BlockBlobUploadResponse } from '@azure/storage-blob'

interface AzureConfig {
  accountName: string
  accountKey: string
  containerName: string
}

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

class AzureBlobStorage {
  private blobServiceClient: BlobServiceClient | null = null
  private config: AzureConfig
  private containerName: string

  constructor() {
    this.config = {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'photo-to-3d-uploads'
    }
    this.containerName = this.config.containerName

    // Only initialize client if we have valid (non-placeholder) credentials
    const hasValidCredentials = this.config.accountName && 
      this.config.accountName !== 'your-storage-account-name' &&
      this.config.accountKey && 
      this.config.accountKey !== 'your-storage-account-key'

    if (hasValidCredentials) {
      this.initializeClient()
    }
  }

  private initializeClient() {
    try {
      const sharedKeyCredential = new StorageSharedKeyCredential(
        this.config.accountName,
        this.config.accountKey
      )

      this.blobServiceClient = new BlobServiceClient(
        `https://${this.config.accountName}.blob.core.windows.net`,
        sharedKeyCredential
      )
    } catch (error) {
      console.error('Failed to initialize Azure Blob Storage client:', error)
    }
  }

  // Ensure container exists
  async ensureContainer(): Promise<boolean> {
    if (!this.blobServiceClient) {
      console.error('Azure Blob Storage client not initialized')
      return false
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      // Don't set public access since it's disabled on the storage account
      await containerClient.createIfNotExists()
      return true
    } catch (error) {
      console.error('Failed to create/verify container:', error)
      return false
    }
  }

  // Upload a file to Azure Blob Storage
  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream',
    folder: string = ''
  ): Promise<UploadResult> {
    if (!this.blobServiceClient) {
      return {
        success: false,
        error: 'Azure Blob Storage not configured. Please check your environment variables.'
      }
    }

    try {
      // Ensure container exists
      const containerReady = await this.ensureContainer()
      if (!containerReady) {
        return {
          success: false,
          error: 'Failed to create or access container'
        }
      }

      // Generate blob name with folder structure
      const blobName = folder ? `${folder}/${fileName}` : fileName
      
      // Get container client and blob client
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)

      // Upload the file
      const uploadResponse: BlockBlobUploadResponse = await blockBlobClient.upload(
        file,
        file.length,
        {
          blobHTTPHeaders: {
            blobContentType: contentType
          }
        }
      )

      if (uploadResponse.errorCode) {
        throw new Error(`Upload failed: ${uploadResponse.errorCode}`)
      }

      // Generate the public URL
      const url = `https://${this.config.accountName}.blob.core.windows.net/${this.containerName}/${blobName}`

      return {
        success: true,
        url
      }
    } catch (error) {
      console.error('Azure Blob Storage upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      }
    }
  }

  // Upload multiple photos for a model
  async uploadPhotos(
    photos: Array<{ buffer: Buffer; originalName: string; mimeType: string }>,
    modelId: string,
    userId: string
  ): Promise<{
    success: boolean
    uploadedFiles: Array<{ originalName: string; url: string; size: number }>
    errors: Array<{ originalName: string; error: string }>
  }> {
    const uploadedFiles: Array<{ originalName: string; url: string; size: number }> = []
    const errors: Array<{ originalName: string; error: string }> = []

    for (const photo of photos) {
      // Generate unique filename
      const timestamp = Date.now()
      const extension = photo.originalName.split('.').pop() || 'jpg'
      const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`
      
      // Upload to Azure Blob Storage
      const result = await this.uploadFile(
        photo.buffer,
        fileName,
        photo.mimeType,
        `users/${userId}/models/${modelId}/photos`
      )

      if (result.success && result.url) {
        uploadedFiles.push({
          originalName: photo.originalName,
          url: result.url,
          size: photo.buffer.length
        })
      } else {
        errors.push({
          originalName: photo.originalName,
          error: result.error || 'Upload failed'
        })
      }
    }

    return {
      success: errors.length === 0,
      uploadedFiles,
      errors
    }
  }

  // Generate a presigned URL for direct upload (if needed)
  async generatePresignedUrl(
    fileName: string,
    folder: string = '',
    expiryMinutes: number = 60
  ): Promise<string | null> {
    if (!this.blobServiceClient) {
      console.error('Azure Blob Storage client not initialized')
      return null
    }

    try {
      const blobName = folder ? `${folder}/${fileName}` : fileName
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)

      // Generate SAS token for upload
      const expiryTime = new Date()
      expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes)

      // Note: For production, you'd want to implement proper SAS token generation
      // This is a simplified approach - in production, use generateBlobSASQueryParameters
      return blockBlobClient.url
    } catch (error) {
      console.error('Failed to generate presigned URL:', error)
      return null
    }
  }

  // Delete a file from Azure Blob Storage
  async deleteFile(blobName: string): Promise<boolean> {
    if (!this.blobServiceClient) {
      console.error('Azure Blob Storage client not initialized')
      return false
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)
      
      await blockBlobClient.deleteIfExists()
      return true
    } catch (error) {
      console.error('Failed to delete file:', error)
      return false
    }
  }

  // Check if Azure Blob Storage is properly configured
  isConfigured(): boolean {
    // Check for valid credentials, not placeholder values
    const hasValidAccountName = this.config.accountName && 
      this.config.accountName !== 'your-storage-account-name' &&
      this.config.accountName.length > 0
    
    const hasValidAccountKey = this.config.accountKey && 
      this.config.accountKey !== 'your-storage-account-key' &&
      this.config.accountKey.length > 0
    
    return !!(hasValidAccountName && hasValidAccountKey && this.blobServiceClient)
  }

  // Get storage info
  getStorageInfo() {
    return {
      isConfigured: this.isConfigured(),
      accountName: this.config.accountName,
      containerName: this.containerName,
      endpoint: this.config.accountName ? `https://${this.config.accountName}.blob.core.windows.net` : null
    }
  }
}

export const azureStorage = new AzureBlobStorage()
export default AzureBlobStorage