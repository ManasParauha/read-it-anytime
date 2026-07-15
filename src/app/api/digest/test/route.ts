import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user via Supabase server client
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Check if the user has any qualifying links (status DONE, past 7 days, undigested)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const qualifyingLinksCount = await db.link.count({
      where: {
        userId: user.id,
        status: 'DONE',
        createdAt: { gte: sevenDaysAgo },
        digestedAt: null,
      },
    })

    if (qualifyingLinksCount === 0) {
      return Response.json({
        message: 'No qualifying links found from the past 7 days to digest. Empty digest email skipped.',
        linksChecked: 0,
      }, { status: 200 })
    }

    // 3. Trigger the per-user Inngest digest function immediately on-demand
    const sendEventResult = await inngest.send({
      name: 'digest/user.requested',
      data: {
        userId: user.id,
        userEmail: user.email!,
        weekStart: sevenDaysAgo.toISOString(),
        weekEnd: now.toISOString(),
      },
    })

    return Response.json({
      message: 'Weekly digest generation triggered successfully in the background.',
      eventId: sendEventResult.ids[0],
      linksToDigest: qualifyingLinksCount,
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error triggering manual digest:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
