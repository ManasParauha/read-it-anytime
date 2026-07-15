import { db } from '@/lib/db'

export async function GET() {
  try {
    // Perform a lightweight database query to verify connection
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', database: 'connected' }, { status: 200 })
  } catch (error: any) {
    console.error('Health check failed:', error)
    return Response.json(
      { status: 'error', error: error?.message || 'Database connection failed' },
      { status: 500 }
    )
  }
}
