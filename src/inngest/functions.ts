import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'
import { safeFetch } from '@/lib/ssrf'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { categorizeAndSummarize } from '@/lib/ai'

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
