import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { scrapeLink, weeklyDigestCron, sendUserDigest } from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scrapeLink,
    weeklyDigestCron,
    sendUserDigest,
  ],
})
