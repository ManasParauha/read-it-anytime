import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/config'
import { Footer } from '@/components/Footer'

// Helper component to render the App Name in the branded layout
// where the last word is in the italic serif style.
function Logo() {
  const words = APP_NAME.split(' ')
  if (words.length > 1) {
    const lastWord = words[words.length - 1]
    const mainPart = words.slice(0, -1).join(' ')
    return (
      <>
        {mainPart}{' '}
        <span className="font-serif italic font-light">{lastWord}</span>
      </>
    )
  }
  return <>{APP_NAME}</>
}

export default async function HomePage() {
  const supabase = await createClient()

  // Retrieve session server-side
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthenticated = !!user

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {/* Navigation Header */}
      <header className="border-b border-hairline/60 sticky top-0 bg-canvas/90 backdrop-blur-sm z-50">
        <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-xl font-normal tracking-tight text-ink hover:opacity-90 transition-opacity">
            <Logo />
          </Link>
          <div>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="text-xs font-mono tracking-wider text-body-strong hover:text-ink transition-all border border-hairline px-4 py-2 rounded-sm bg-canvas-soft/40 hover:bg-canvas-soft/90"
              >
                DASHBOARD
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-xs font-mono tracking-wider text-body-strong hover:text-ink transition-all border border-hairline px-4 py-2 rounded-sm bg-canvas-soft/40 hover:bg-canvas-soft/90"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center">
        <section className="flex flex-col items-center justify-center text-center px-6 py-20 md:py-32 max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="text-[10px] font-mono uppercase text-mute tracking-widest">
              PERSONAL PRODUCTIVITY TOOL
            </div>
            <h1 className="text-4.5xl md:text-6xl font-normal tracking-tighter leading-1.1 text-ink max-w-3xl">
              Stop losing links you meant to read. Save them, and get an AI-summarized digest every week.
            </h1>
          </div>
          
          <p className="text-base md:text-lg text-body max-w-2xl leading-relaxed">
            A personal link curator that strips clutter, extracts the core text, categorizes content automatically, and delivers a clean compiled briefing to your inbox. No distractions, no backlog anxiety.
          </p>

          <div className="pt-4">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-block bg-primary text-on-primary font-medium px-8 py-3 rounded-sm hover:bg-primary/95 transition-all text-sm tracking-wider font-mono"
              >
                GO TO DASHBOARD
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-block bg-primary text-on-primary font-medium px-8 py-3 rounded-sm hover:bg-primary/95 transition-all text-sm tracking-wider font-mono"
              >
                GET STARTED
              </Link>
            )}
          </div>
        </section>

        {/* Problem Framing Section */}
        <section className="border-t border-hairline/60 bg-canvas-soft/10">
          <div className="py-16 md:py-24 max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <h2 className="text-xs font-mono uppercase text-mute tracking-wider mt-1">
                The Problem
              </h2>
            </div>
            <div className="md:col-span-3 space-y-6 text-lg md:text-xl text-body-strong font-light leading-relaxed">
              <p>
                We bookmark interesting articles on X, save threads on LinkedIn, and copy posts on Reddit, promising ourselves we'll read them later.
              </p>
              <p>
                But we never do. Bookmarks folders become a dark graveyard — a growing pile of reading debt that is too overwhelming to click through.
              </p>
              <p>
                You need a system that processes these saved insights for you and resurfaces them in a digestible format, instead of letting them sit forgotten.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="border-t border-hairline/60">
          <div className="py-16 md:py-24 max-w-4xl mx-auto px-6 space-y-12">
            <h2 className="text-xs font-mono uppercase text-mute tracking-wider">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="font-serif italic text-4xl text-body/30">01</div>
                <h3 className="text-base font-normal text-ink">Paste a link.</h3>
                <p className="text-sm text-body leading-relaxed">
                  Drop any developer article or documentation URL into your personal queue.
                </p>
              </div>
              <div className="space-y-4">
                <div className="font-serif italic text-4xl text-body/30">02</div>
                <h3 className="text-base font-normal text-ink">AI reads and categorizes.</h3>
                <p className="text-sm text-body leading-relaxed">
                  Our background worker extracts the readability content, removes spam, and tags it automatically.
                </p>
              </div>
              <div className="space-y-4">
                <div className="font-serif italic text-4xl text-body/30">03</div>
                <h3 className="text-base font-normal text-ink">Get a weekly email digest.</h3>
                <p className="text-sm text-body leading-relaxed">
                  Every Sunday, you receive a clean compiled email newsletter with AI summaries of all your links.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-hairline/60 bg-canvas-soft/10">
          <div className="py-16 md:py-24 max-w-4xl mx-auto px-6 space-y-12">
            <h2 className="text-xs font-mono uppercase text-mute tracking-wider">
              Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feature 1 */}
              <div className="rounded-md border border-hairline bg-canvas-soft p-6 space-y-4 flex flex-col justify-between transition-all hover:bg-canvas-soft/90 hover:border-mute/45">
                <div className="space-y-2">
                  <div className="text-[10px] text-mute font-mono uppercase tracking-wider">
                    01 // CLASSIFICATION
                  </div>
                  <h3 className="text-lg font-normal text-ink">AI Categorization</h3>
                  <p className="text-sm text-body leading-relaxed">
                    No manual sorting. Our system categorizes your submissions into tech, design, AI, or business tags dynamically based on content.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-md border border-hairline bg-canvas-soft p-6 space-y-4 flex flex-col justify-between transition-all hover:bg-canvas-soft/90 hover:border-mute/45">
                <div className="space-y-2">
                  <div className="text-[10px] text-mute font-mono uppercase tracking-wider">
                    02 // DELIVERABLE
                  </div>
                  <h3 className="text-lg font-normal text-ink">Weekly Email Digest</h3>
                  <p className="text-sm text-body leading-relaxed">
                    A summarized briefing sent directly to your inbox every week, helping you catch up on all your saved links in a single sitting.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-md border border-hairline bg-canvas-soft p-6 space-y-4 flex flex-col justify-between transition-all hover:bg-canvas-soft/90 hover:border-mute/45">
                <div className="space-y-2">
                  <div className="text-[10px] text-mute font-mono uppercase tracking-wider">
                    03 // INTERACTIVE
                  </div>
                  <h3 className="text-lg font-normal text-ink">Search & Filters</h3>
                  <p className="text-sm text-body leading-relaxed">
                    Quickly filter your links by reading status or dynamic tags. Instant search lets you retrieve any bookmarked article in seconds.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="rounded-md border border-hairline bg-canvas-soft p-6 space-y-4 flex flex-col justify-between transition-all hover:bg-canvas-soft/90 hover:border-mute/45">
                <div className="space-y-2">
                  <div className="text-[10px] text-mute font-mono uppercase tracking-wider">
                    04 // PRIVACY
                  </div>
                  <h3 className="text-lg font-normal text-ink">Private by Default</h3>
                  <p className="text-sm text-body leading-relaxed">
                    Your queue is strictly private, visible only to you. We do not sell data, track browsing activity, or build public social feeds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer variant="landing" />
    </div>
  )
}
