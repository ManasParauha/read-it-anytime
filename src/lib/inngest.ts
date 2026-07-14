import { Inngest } from 'inngest'

const isDev = process.env.NODE_ENV === 'development' || 
              !process.env.INNGEST_EVENT_KEY || 
              process.env.INNGEST_EVENT_KEY === 'local'

export const inngest = new Inngest({
  id: 'read-it-anytime',
  eventKey: process.env.INNGEST_EVENT_KEY || 'local',
  baseUrl: isDev ? 'http://127.0.0.1:8288' : undefined,
})
