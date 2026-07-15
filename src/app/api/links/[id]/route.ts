import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership of the link before deleting
    const link = await db.link.findUnique({
      where: { id },
    })

    if (!link || link.userId !== user.id) {
      return Response.json({ error: 'Link not found' }, { status: 404 })
    }

    await db.link.delete({
      where: { id },
    })

    return new Response(null, { status: 204 })
  } catch (error: any) {
    console.error('Error deleting link:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership of the link
    const link = await db.link.findUnique({
      where: { id },
    })

    if (!link || link.userId !== user.id) {
      return Response.json({ error: 'Link not found' }, { status: 404 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.archived !== undefined) {
      updateData.archived = Boolean(body.archived)
    }

    if (body.readAt !== undefined) {
      if (body.readAt === true) {
        updateData.readAt = new Date()
      } else if (body.readAt === false || body.readAt === null) {
        updateData.readAt = null
      } else {
        updateData.readAt = new Date(body.readAt)
      }
    }

    const updated = await db.link.update({
      where: { id },
      data: updateData,
    })

    return Response.json(updated)
  } catch (error: any) {
    console.error('Error updating link:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
