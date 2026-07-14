import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest'
import { isUrlSafe } from '@/lib/ssrf'
import { getWeekStart } from '@/inngest/functions'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate Supabase user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user row exists in public."User" table (self-healing for out-of-sync auth states)
    await db.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
      },
    })

    // 2. Parse request body
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // 3. Validate URL syntax and protocol
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return Response.json({ error: 'URL protocol must be http or https' }, { status: 400 })
    }

    // 4. Perform DNS / SSRF checks on initial URL
    const isSafe = await isUrlSafe(url)
    if (!isSafe) {
      return Response.json({
        error: 'SSRF Blocked: URL points to an internal or reserved IP address range.'
      }, { status: 400 })
    }

    // 5. Check weekly limits (linksProcessed >= 25)
    const weekStart = getWeekStart()
    const usage = await db.usage.findUnique({
      where: {
        userId_weekStart: {
          userId: user.id,
          weekStart,
        },
      },
    })

    if (usage && usage.linksProcessed >= 25) {
      return Response.json({
        error: 'Weekly link processing limit reached (max 25/week). Please try again next week.'
      }, { status: 429 })
    }

    // 6. Create Link row with PENDING status
    const link = await db.link.create({
      data: {
        userId: user.id,
        url,
        status: 'PENDING',
      },
    })

    // 7. Trigger Inngest background scraping job
    await inngest.send({
      name: 'link/submitted',
      data: {
        linkId: link.id,
      },
    })

    // 8. Return 202 Accepted with link ID
    return Response.json({ id: link.id }, { status: 202 })

  } catch (error: any) {
    console.error('Error submitting link:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Authenticate Supabase user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user row exists in public."User" table
    await db.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
      },
    })

    // Fetch user's links
    const links = await db.link.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json(links)

  } catch (error: any) {
    console.error('Error fetching links:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
