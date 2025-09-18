import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    const modelId = resolvedParams.id

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
          include: {
            backgroundRemovedImage: true
          }
        },
        modelExports: true,
        _count: {
          select: {
            photoUploads: true
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

    // Convert BigInt values to strings for JSON serialization
    const modelForJson = {
      ...model,
      photoUploads: model.photoUploads.map(photo => ({
        ...photo,
        fileSize: photo.fileSize?.toString(),
        backgroundRemovedImage: photo.backgroundRemovedImage ? {
          ...photo.backgroundRemovedImage,
          fileSize: photo.backgroundRemovedImage.fileSize?.toString()
        } : null
      })),
      modelExports: model.modelExports.map(modelExport => ({
        ...modelExport,
        fileSize: modelExport.fileSize?.toString()
      }))
    }

    return NextResponse.json({ model: modelForJson })
  } catch (error) {
    console.error("Error fetching model:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}