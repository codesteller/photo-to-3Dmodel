import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { azureStorage } from "@/lib/azure-storage"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
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
    const pathSegments = resolvedParams.path
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      )
    }

    // Reconstruct the blob path
    const blobPath = pathSegments.join('/')
    
    // Security check: Ensure the file belongs to the authenticated user
    // Check if it's a user file path
    if (!blobPath.startsWith(`users/${session.user.id}/`)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Additional security: Verify ownership through database if it's a model file
    if (blobPath.includes('/models/')) {
      const modelIdMatch = blobPath.match(/models\/([^\/]+)/)
      if (modelIdMatch) {
        const modelId = modelIdMatch[1]
        
        // Verify the model belongs to the user
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
            { error: "File not found or access denied" },
            { status: 404 }
          )
        }
      }
    }

    // Generate secure download URL with SAS token
    const downloadUrl = await azureStorage.generateDownloadUrl(blobPath, 60) // 1 hour expiry
    
    if (!downloadUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      )
    }

    // Return the secure URL
    return NextResponse.json({
      downloadUrl,
      expiresIn: 3600 // 1 hour in seconds
    })
  } catch (error) {
    console.error("Error generating download URL:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}