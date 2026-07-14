'use client'

import { useState, useEffect } from 'react'

interface Link {
  id: string
  userId: string
  url: string
  title: string | null
  cleanedText: string | null
  category: string | null
  summary: string | null
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  createdAt: string
  failureReason: string | null
}

interface DashboardContentProps {
  initialLinks: Link[]
  userEmail: string | undefined
}

export function DashboardContent({ initialLinks, userEmail }: DashboardContentProps) {
  const [links, setLinks] = useState<Link[]>(initialLinks)
  const [urlInput, setUrlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Poll for links status updates
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const response = await fetch('/api/links')
        if (response.ok) {
          const updatedLinks = await response.json()
          setLinks(updatedLinks)
        }
      } catch (err) {
        console.error('Error polling links:', err)
      }
    }

    const interval = setInterval(fetchLinks, 4000)
    return () => clearInterval(interval)
  }, [])

  // Handle link submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)

    const urlToSubmit = urlInput.trim()

    if (!urlToSubmit) {
      setErrorMsg('Please enter a URL')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlToSubmit }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit link')
      }

      // Clear input on success
      setUrlInput('')
      
      // Fetch links immediately to show the new pending item
      const refreshResponse = await fetch('/api/links')
      if (refreshResponse.ok) {
        const updatedLinks = await refreshResponse.json()
        setLinks(updatedLinks)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).toUpperCase()
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-8 w-full">
      {/* Submit Form Card */}
      <section className="rounded-md border border-hairline bg-canvas-soft p-6 md:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-normal text-ink">
            Submit a new link
          </h2>
          <p className="text-sm text-body">
            Paste any article URL. We'll strip clutter, check for safety, and extract readability content.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="https://example.com/article"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={submitting}
            className="flex-1 bg-canvas border border-hairline rounded-sm text-ink placeholder:text-mute px-4 py-2.5 text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-primary/25 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary font-medium px-6 py-2.5 rounded-sm hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm tracking-wide shrink-0 transition-all"
          >
            {submitting ? 'SUBMITTING...' : 'ADD LINK'}
          </button>
        </form>

        {errorMsg && (
          <div className="rounded-xs border border-red-950 bg-red-950/20 p-4 text-xs text-red-400 font-sans flex items-start gap-2 animate-fadeIn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <div>
              <span className="font-semibold block mb-0.5">Submission Error</span>
              {errorMsg}
            </div>
          </div>
        )}
      </section>

      {/* Links Curation List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-body-strong">
            Your Link Curation Queue ({links.length})
          </h3>
          <span className="text-[10px] font-mono text-mute">
            AUTO-POLLING SYNC ACTIVE
          </span>
        </div>

        {links.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline bg-canvas-soft/30 p-12 text-center space-y-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-mute mx-auto opacity-60">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            <p className="text-sm text-body-strong">No links submitted yet.</p>
            <p className="text-xs text-mute">Add an article URL above to populate your weekly feed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map((link) => {
              // Parse domain for cleaner layout
              let domain = ''
              try {
                domain = new URL(link.url).hostname
              } catch {
                domain = link.url
              }

              return (
                <div
                  key={link.id}
                  className="rounded-md border border-hairline bg-canvas-soft p-5 md:p-6 space-y-4 transition-all hover:bg-canvas-soft/80"
                >
                  {/* Top line: URL domain and status badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-mute tracking-wide">
                        {domain.toUpperCase()}
                      </span>
                      <span className="text-hairline font-light">|</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-mute hover:text-ink underline break-all font-mono truncate max-w-xs md:max-w-md"
                      >
                        {link.url}
                      </a>
                    </div>
                    <div>
                      {link.status === 'PENDING' && (
                        <span className="border border-dashed border-hairline text-mute bg-canvas/30 px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wider">
                          PENDING
                        </span>
                      )}
                      {link.status === 'PROCESSING' && (
                        <span className="border border-amber-900/50 text-amber-400 bg-amber-950/20 px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wider animate-pulse flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping" />
                          PROCESSING
                        </span>
                      )}
                      {link.status === 'DONE' && (
                        <span className="border border-emerald-950 text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wider">
                          READY
                        </span>
                      )}
                      {link.status === 'FAILED' && (
                        <span className="border border-red-950 text-red-400 bg-red-950/20 px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-wider">
                          FAILED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title and snippet or status specifics */}
                  <div className="space-y-2">
                    {link.status === 'DONE' && (
                      <>
                        <h4 className="text-md font-medium text-ink font-sans tracking-tight leading-snug">
                          {link.title || 'Untitled Article'}
                        </h4>
                        {link.cleanedText ? (
                          <p className="text-xs text-body leading-relaxed line-clamp-3">
                            {link.cleanedText}
                          </p>
                        ) : (
                          <p className="text-xs text-mute italic">No text content extracted.</p>
                        )}
                      </>
                    )}

                    {link.status === 'PENDING' && (
                      <p className="text-xs text-mute italic">
                        Waiting in queue for processing...
                      </p>
                    )}

                    {link.status === 'PROCESSING' && (
                      <p className="text-xs text-mute italic">
                        Running readability scraper to extract title and body content...
                      </p>
                    )}

                    {link.status === 'FAILED' && (
                      <div className="rounded-xs border border-red-950 bg-red-950/10 p-3 space-y-1">
                        <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider block font-semibold">
                          PROCESSING ERROR Details
                        </span>
                        <p className="text-xs text-body-strong leading-normal">
                          {link.failureReason || 'An unknown error occurred while downloading or extracting the content.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer line: Timestamp */}
                  <div className="border-t border-hairline/40 pt-3 flex items-center justify-between text-[10px] font-mono text-mute">
                    <span>ID: {link.id.substring(0, 8)}...</span>
                    <span>SUBMITTED AT: {formatDate(link.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
