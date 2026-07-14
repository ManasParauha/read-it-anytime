'use client'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (signInError) {
        setError(signInError.message)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 font-sans selection:bg-primary/20 selection:text-primary">
      <div className="w-full max-w-md space-y-8 rounded-md border border-hairline bg-canvas-soft p-8 shadow-2xl">
        
        {/* Header */}
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-normal tracking-tight text-ink">
            Read It <span className="font-serif italic font-light">Anytime</span>
          </h1>
          <p className="text-sm text-mute">
            Your links, cleaned and summarized into a clean <span className="font-serif italic text-body-strong font-light">weekly digest</span>.
          </p>
        </div>

        {/* OAuth Form Button */}
        <div className="space-y-4 pt-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xs bg-primary px-4 py-3 text-sm font-medium text-on-primary transition-all duration-150 hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              aria-hidden="true"
              focusable="false"
              data-prefix="fab"
              data-icon="google"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 488 512"
            >
              <path
                fill="currentColor"
                d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
              ></path>
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {error && (
            <div className="rounded-xs border border-red-950 bg-red-950/20 p-3 text-xs text-red-400">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-hairline pt-6 text-center text-[11px] text-mute">
          <p className="font-mono">
            SECURE AUTHENTICATION BY SUPABASE
          </p>
        </div>
      </div>
    </div>
  )
}
