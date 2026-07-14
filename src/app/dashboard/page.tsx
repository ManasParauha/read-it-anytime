import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
      <main className="flex flex-1 flex-col justify-center py-12 max-w-4xl mx-auto w-full space-y-8">
        <div className="rounded-md border border-hairline bg-canvas-soft p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-normal text-ink">Welcome back.</h2>
            <p className="text-sm text-mute">
              Your link curation dashboard is successfully set up and authenticated with Supabase.
            </p>
          </div>

          <div className="border-t border-hairline pt-6 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-body-strong">Active Session Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-canvas p-4 rounded-xs border border-hairline font-mono text-xs text-body space-y-1">
                <span className="text-mute block">USER ID</span>
                <span className="text-ink break-all">{user.id}</span>
              </div>
              <div className="bg-canvas p-4 rounded-xs border border-hairline font-mono text-xs text-body space-y-1">
                <span className="text-mute block">PROVIDER</span>
                <span className="text-ink">Google OAuth</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline pt-6 text-center text-xs text-mute font-mono mt-auto">
        WARP DESIGN MODE // SYSTEM STATE READY
      </footer>
    </div>
  )
}
