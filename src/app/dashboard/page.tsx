import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { SignOutButton } from './SignOutButton'
import { DashboardContent } from './DashboardContent'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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

  // Fetch initial links for server rendering
  const initialLinks = await db.link.findMany({
    where: { userId: user.id, archived: false },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 21,
  })

  let nextCursor: string | null = null
  if (initialLinks.length > 20) {
    nextCursor = initialLinks[20].id
    initialLinks.pop()
  }

  // Fetch all unique categories of the user for filter rendering
  const userLinksCategories = await db.link.findMany({
    where: { userId: user.id },
    select: { category: true },
  })
  const userCategories = Array.from(
    new Set(
      userLinksCategories
        .map((l) => l.category?.toLowerCase())
        .filter(Boolean) as string[]
    )
  )

  // Format type compatibility (Date to string serialization)
  const serializedLinks = initialLinks.map((link) => ({
    ...link,
    createdAt: link.createdAt.toISOString(),
    readAt: link.readAt ? link.readAt.toISOString() : null,
    digestedAt: link.digestedAt ? link.digestedAt.toISOString() : null,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-6 py-12 font-sans md:px-12">
      {/* Shell header */}
      <header className="flex items-center justify-between border-b border-hairline pb-6">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-ink">
            Read It <span className="font-serif italic font-light">Anytime</span>
          </h1>
          <p className="text-xs text-mute font-mono uppercase tracking-wider mt-1">
            Developer Link Curator
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-body-strong font-mono hidden sm:inline">
            LOGGED IN AS: {user.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      {/* Main dashboard content */}
      <main className="flex flex-1 flex-col py-12 max-w-4xl mx-auto w-full">
        <DashboardContent
          initialLinks={serializedLinks}
          initialNextCursor={nextCursor}
          userEmail={user.email}
          userCategories={userCategories}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline pt-6 text-center text-xs text-mute font-mono mt-auto">
        WARP DESIGN MODE // SYSTEM STATE READY
      </footer>
    </div>
  )
}
