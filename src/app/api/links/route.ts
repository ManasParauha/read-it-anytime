import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { inngest } from '@/lib/inngest'
import { isUrlSafe } from '@/lib/ssrf'
import { getWeekStart } from '@/inngest/functions'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'

const linksRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  analytics: true,
  prefix: 'ratelimit:links',
})

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

    // Rate Limiting: 10 requests per minute per user
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const { success, limit, reset, remaining } = await linksRateLimit.limit(user.id)
        if (!success) {
          return Response.json(
            { error: 'Too many requests. You are limited to 10 submissions per minute.' },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': remaining.toString(),
                'X-RateLimit-Reset': reset.toString(),
              },
            }
          )
        }
      } catch (err) {
        console.error('Rate limiting error in links:', err)
      }
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

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const status = searchParams.get('status') || undefined
    const archivedParam = searchParams.get('archived')
    const archived = archivedParam === 'true' // defaults to false if omitted
    const sort = searchParams.get('sort') || 'newest'
    const cursor = searchParams.get('cursor') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Build the query where clause using AND conditions to combine filters cleanly
    const andConditions: any[] = [
      { userId: user.id },
      { archived: archived }
    ]

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { url: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    if (category) {
      const categories = category.split(',').map((c) => c.trim()).filter(Boolean)
      if (categories.length > 0) {
        andConditions.push({
          OR: categories.map((cat) => ({
            category: { equals: cat, mode: 'insensitive' }
          }))
        })
      }
    }

    if (status) {
      andConditions.push({ status })
    }

    const whereClause = {
      AND: andConditions
    }

    // Build the order by clause
    let orderBy: any = [{ createdAt: 'desc' }, { id: 'desc' }]
    if (sort === 'oldest') {
      orderBy = [{ createdAt: 'asc' }, { id: 'asc' }]
    } else if (sort === 'category') {
      orderBy = [
        { category: 'asc' },
        { createdAt: 'desc' },
        { id: 'desc' }
      ]
    }

    // Build Prisma query options
    const queryOptions: any = {
      where: whereClause,
      orderBy: orderBy,
      take: limit + 1, // fetch one extra to see if there is a next page
    }

    if (cursor) {
      queryOptions.cursor = { id: cursor }
      queryOptions.skip = 1 // skip the cursor record itself
    }

    const links = await db.link.findMany(queryOptions)

    let nextCursor: string | null = null
    if (links.length > limit) {
      const nextItem = links[limit]
      nextCursor = nextItem.id
      links.pop() // remove the extra item
    }

    return Response.json({
      links,
      nextCursor,
    })

  } catch (error: any) {
    console.error('Error fetching links:', error)
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
