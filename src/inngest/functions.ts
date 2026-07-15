import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'
import { safeFetch } from '@/lib/ssrf'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { categorizeAndSummarize } from '@/lib/ai'
import { Resend } from 'resend'

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day
  const sunday = new Date(d.setUTCDate(diff))
  sunday.setUTCHours(0, 0, 0, 0)
  return sunday
}

export const scrapeLink = inngest.createFunction(
  {
    id: 'scrape-link',
    name: 'Scrape and Clean Submitted Link',
    triggers: [{ event: 'link/submitted' }],
  },
  async ({ event, step }) => {
    const { linkId } = event.data

    // 1. Set status to PROCESSING
    await step.run('set-processing-status', async () => {
      await db.link.update({
        where: { id: linkId },
        data: { status: 'PROCESSING' },
      })
    })

    try {
      // Fetch link details
      const link = await step.run('get-link', async () => {
        return await db.link.findUnique({
          where: { id: linkId },
          select: { url: true, userId: true },
        })
      })

      if (!link) {
        throw new Error('Link record not found')
      }

      // Safe fetch content
      const result = await step.run('fetch-url', async () => {
        return await safeFetch(link.url)
      })

      // Parse with jsdom and @mozilla/readability
      const parseResult = await step.run('parse-content', async () => {
        const dom = new JSDOM(result.text, { url: result.finalUrl })
        const doc = dom.window.document
        const reader = new Readability(doc)
        const parsed = reader.parse()

        if (!parsed) {
          throw new Error('Failed to extract article content using Readability')
        }

        const title = parsed.title?.trim() || null
        const cleanedText = parsed.textContent?.trim() || null

        if (!cleanedText) {
          throw new Error('No article text content extracted')
        }

        return { title, cleanedText }
      })

      // Categorize and summarize the clean text with AI
      const aiResult = await step.run('categorize-and-summarize', async () => {
        // Truncate to first 6000 characters to control costs
        const truncatedText = parseResult.cleanedText ? parseResult.cleanedText.substring(0, 6000) : ''
        return await categorizeAndSummarize(truncatedText)
      })

      // Update link with parsed results and increment user's weekly usage limit
      await step.run('save-success', async () => {
        await db.link.update({
          where: { id: linkId },
          data: {
            status: 'DONE',
            title: parseResult.title,
            cleanedText: parseResult.cleanedText,
            category: aiResult.category,
            summary: aiResult.summary,
          },
        })

        const weekStart = getWeekStart()

        await db.usage.upsert({
          where: {
            userId_weekStart: {
              userId: link.userId,
              weekStart,
            },
          },
          update: {
            linksProcessed: {
              increment: 1,
            },
          },
          create: {
            userId: link.userId,
            weekStart,
            linksProcessed: 1,
          },
        })
      })

    } catch (error: any) {
      const reason = error?.message || 'Unknown processing error'
      await step.run('save-failure', async () => {
        await db.link.update({
          where: { id: linkId },
          data: {
            status: 'FAILED',
            failureReason: reason.substring(0, 255),
          },
        })
      })
    }
  }
)

export const weeklyDigestCron = inngest.createFunction(
  {
    id: 'weekly-digest-cron',
    name: 'Weekly Digest Cron Trigger',
    triggers: [{ cron: '0 8 * * 1' }],
  },
  async ({ step }) => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Find users with qualifying links
    const users = await step.run('query-eligible-users', async () => {
      return await db.user.findMany({
        where: {
          links: {
            some: {
              status: 'DONE',
              createdAt: { gte: sevenDaysAgo },
              digestedAt: null,
            },
          },
        },
        select: {
          id: true,
          email: true,
        },
      })
    })

    if (users.length === 0) {
      return { message: 'No eligible users for weekly digest' }
    }

    // Fan out to a per-user function
    const events = users.map((user) => ({
      name: 'digest/user.requested',
      data: {
        userId: user.id,
        userEmail: user.email,
        weekStart: sevenDaysAgo.toISOString(),
        weekEnd: now.toISOString(),
      },
    }))

    await step.sendEvent('fan-out-user-digests', events)

    return { dispatchedCount: events.length }
  }
)

export const sendUserDigest = inngest.createFunction(
  {
    id: 'send-user-digest',
    name: 'Send User Digest Email',
    concurrency: 5,
    triggers: [{ event: 'digest/user.requested' }],
  },
  async ({ event, step }) => {
    const { userId, userEmail, weekStart, weekEnd } = event.data

    const weekStartDate = new Date(weekStart)
    const weekEndDate = new Date(weekEnd)

    // 1. Fetch links for the user in the past 7 days that aren't digested yet
    const links = await step.run('fetch-user-links', async () => {
      return await db.link.findMany({
        where: {
          userId,
          status: 'DONE',
          createdAt: {
            gte: weekStartDate,
            lte: weekEndDate,
          },
          digestedAt: null,
        },
        select: {
          id: true,
          url: true,
          title: true,
          summary: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    if (links.length === 0) {
      return { message: `No qualifying links for user ${userId}, skipping digest.` }
    }

    // 2. Group links by category
    const groupedLinks: Record<string, typeof links> = {}
    for (const link of links) {
      const categoryName = link.category || 'Uncategorized'
      if (!groupedLinks[categoryName]) {
        groupedLinks[categoryName] = []
      }
      groupedLinks[categoryName].push(link)
    }

    // 3. Render HTML email (plain, email-client-safe inline styles, no external JS/CSS)
    const emailHtml = await step.run('render-email-html', async () => {
      let categoriesHtml = ''
      for (const [category, categoryLinks] of Object.entries(groupedLinks)) {
        let linksHtml = ''
        for (const link of categoryLinks) {
          const titleText = link.title || link.url
          const summaryText = link.summary || 'No summary available.'
          linksHtml += `
            <div style="margin-bottom: 16px;">
              <a href="${link.url}" target="_blank" style="font-size: 16px; font-weight: bold; color: #2b2622; text-decoration: underline; font-family: Inter, Helvetica, Arial, sans-serif;">
                ${titleText}
              </a>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #555555; line-height: 1.5; font-family: Inter, Helvetica, Arial, sans-serif;">
                ${summaryText}
              </p>
            </div>
          `
        }
        categoriesHtml += `
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #aea69c; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; font-family: Inter, Helvetica, Arial, sans-serif;">
              ${category}
            </h3>
            ${linksHtml}
          </div>
        `
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Weekly Digest</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f7f5f0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f5f0; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #aea69c; border-radius: 4px; padding: 32px;">
                  <tr>
                    <td>
                      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: bold; color: #2b2622; font-family: Inter, Helvetica, Arial, sans-serif;">
                        Weekly Digest
                      </h1>
                      <p style="margin: 0 0 24px 0; font-size: 14px; color: #555555; font-family: Inter, Helvetica, Arial, sans-serif; line-height: 1.5;">
                        Here are the articles you saved in the last 7 days:
                      </p>
                      
                      ${categoriesHtml}
                      
                      <div style="margin-top: 32px; border-top: 1px solid #aea69c; padding-top: 16px; font-size: 12px; color: #aea69c; font-family: Inter, Helvetica, Arial, sans-serif; text-align: center; line-height: 1.5;">
                        <p style="margin: 0 0 4px 0;">
                          You're receiving this because you saved links in Read It Anytime.
                        </p>
                        <p style="margin: 0;">
                          (TODO: Add unsubscribe flow for production compliance)
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    })

    // 4. Send email via Resend
    await step.run('send-email', async () => {
      const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder')
      
      const { data, error } = await resend.emails.send({
        from: 'Read It Anytime <onboarding@resend.dev>',
        to: [userEmail],
        subject: `Your Weekly Digest (${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()})`,
        html: emailHtml,
      })

      if (error) {
        console.error('Failed to send digest email:', error)
        throw new Error(`Resend API Error: ${error.name} - ${error.message}`)
      }

      return data
    })

    // 5. On success: create Digest row and mark links as digested
    await step.run('save-digest-success', async () => {
      await db.$transaction(async (tx) => {
        // Create Digest row
        await tx.digest.create({
          data: {
            userId,
            weekStart: weekStartDate,
            weekEnd: weekEndDate,
            sentAt: new Date(),
          },
        })

        // Update links to mark as digested
        await tx.link.updateMany({
          where: {
            id: {
              in: links.map((link) => link.id),
            },
          },
          data: {
            digestedAt: new Date(),
          },
        })
      })
    })

    return { success: true, processedCount: links.length }
  }
)

