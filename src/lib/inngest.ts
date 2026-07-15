import { Inngest, Middleware } from 'inngest'
import * as Sentry from '@sentry/nextjs'

class SentryMiddleware extends Middleware.BaseMiddleware {
  readonly id = 'sentry-middleware'

  override async wrapFunctionHandler({ ctx, next }: Middleware.WrapFunctionHandlerArgs) {
    try {
      return await next()
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag('inngest.event.name', ctx.event.name)
        
        // Scrub PII: Keep only linkId and userId, discard URLs/emails
        const customContext: Record<string, any> = {}
        if (ctx.event.data) {
          if ('linkId' in ctx.event.data) {
            customContext.linkId = ctx.event.data.linkId
          }
          if ('userId' in ctx.event.data) {
            customContext.userId = ctx.event.data.userId
          }
        }
        scope.setContext('Inngest Event Data', customContext)
        Sentry.captureException(error)
      })
      throw error
    }
  }
}


const isDev = process.env.NODE_ENV === 'development' || 
              !process.env.INNGEST_EVENT_KEY || 
              process.env.INNGEST_EVENT_KEY === 'local'

export const inngest = new Inngest({
  id: 'read-it-anytime',
  eventKey: process.env.INNGEST_EVENT_KEY || 'local',
  baseUrl: isDev ? 'http://127.0.0.1:8288' : undefined,
  middleware: [SentryMiddleware],
})

