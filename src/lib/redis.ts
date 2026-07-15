import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Warn but don't crash at import time in case they are not yet configured in local dev.
  console.warn('WARNING: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set.')
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})
