'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Link {
  id: string
  userId: string
  url: string
  title: string | null
  cleanedText: string | null
  category: string | null
  summary: string | null
  failureReason: string | null
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  createdAt: string
  digestedAt: string | null
  archived: boolean
  readAt: string | null
}

interface DashboardContentProps {
  initialLinks: Link[]
  initialNextCursor: string | null
  userEmail: string | undefined
  userCategories: string[]
}

export function DashboardContent({ initialLinks, initialNextCursor, userEmail, userCategories }: DashboardContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Sync URL parameters to states
  const currentSearch = searchParams.get('search') || ''
  const currentStatus = searchParams.get('status') || ''
  const currentSort = searchParams.get('sort') || 'newest'
  const currentArchived = searchParams.get('archived') === 'true'
  
  // Parse categories safely
  const categoryParam = searchParams.get('category')
  const currentCategories = categoryParam ? categoryParam.split(',').filter(Boolean) : []

  // Core component states
  const [links, setLinks] = useState<Link[]>(initialLinks)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [searchInput, setSearchInput] = useState(currentSearch)
  const [urlInput, setUrlInput] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const [availableCategories, setAvailableCategories] = useState<string[]>(() => {
    const base = ['tech', 'design', 'ai', 'business']
    return Array.from(new Set([...base, ...userCategories]))
  })

  const updateAvailableCategories = (newLinks: Link[]) => {
    const categoriesInLinks = newLinks.map(l => l.category?.toLowerCase()).filter(Boolean) as string[]
    if (categoriesInLinks.length > 0) {
      setAvailableCategories(prev => Array.from(new Set([...prev, ...categoriesInLinks])))
    }
  }

  // Synchronize initial rendering or page load state when URL search params are empty
  useEffect(() => {
    const hasFilters = searchParams.has('search') || searchParams.has('status') || searchParams.has('category') || searchParams.has('sort') || searchParams.has('archived')
    if (isInitialLoad && !hasFilters) {
      setIsInitialLoad(false)
      return
    }

    setIsInitialLoad(false)

    const fetchFilteredLinks = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/links?${searchParams.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setLinks(data.links)
          setNextCursor(data.nextCursor)
          updateAvailableCategories(data.links)
        }
      } catch (err) {
        console.error('Error fetching filtered links:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchFilteredLinks()
  }, [searchParams])

  // Debounced search effect (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQueryParams({ search: searchInput || null })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, currentSearch])

  // Poll for links status updates ONLY when there are active pending or processing items in queue
  useEffect(() => {
    const hasPendingOrProcessing = links.some(l => l.status === 'PENDING' || l.status === 'PROCESSING')
    if (!hasPendingOrProcessing) return

    const fetchLinks = async () => {
      try {
        const response = await fetch(`/api/links?${searchParams.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setLinks(data.links)
          setNextCursor(data.nextCursor)
          updateAvailableCategories(data.links)
        }
      } catch (err) {
        console.error('Error polling links:', err)
      }
    }

    const interval = setInterval(fetchLinks, 4000)
    return () => clearInterval(interval)
  }, [links, searchParams])

  // Update query variables in URL and reset cursor
  const updateQueryParams = (updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        params.delete(key)
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','))
      } else {
        params.set(key, value)
      }
    })
    params.delete('cursor') // Reset pagination on filter change
    router.push(pathname + '?' + params.toString())
  }

  // Handle URL submission (from user submission field)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSubmit }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit link')
      }

      setUrlInput('')
      
      // Refresh current list state immediately
      const refreshResponse = await fetch(`/api/links?${searchParams.toString()}`)
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json()
        setLinks(refreshedData.links)
        setNextCursor(refreshedData.nextCursor)
        updateAvailableCategories(refreshedData.links)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Toggle Read/Unread Status
  const handleToggleRead = async (id: string, read: boolean) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readAt: read }),
      })
      if (response.ok) {
        setLinks(prev =>
          prev.map(l => (l.id === id ? { ...l, readAt: read ? new Date().toISOString() : null } : l))
        )
      }
    } catch (err) {
      console.error('Error toggling read state:', err)
    }
  }

  // Handle Toggle Archive/Unarchive
  const handleToggleArchive = async (id: string, archive: boolean) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: archive }),
      })
      if (response.ok) {
        // Remove item from active view since state filter changed
        setLinks(prev => prev.filter(l => l.id !== id))
      }
    } catch (err) {
      console.error('Error toggling archive state:', err)
    }
  }

  // Handle Link Deletion
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setLinks(prev => prev.filter(l => l.id !== id))
        setConfirmDeleteId(null)
      }
    } catch (err) {
      console.error('Error deleting link:', err)
    }
  }

  // Handle Cursor-based Pagination
  const handleLoadMore = async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cursor', nextCursor)
      
      const response = await fetch(`/api/links?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setLinks(prev => [...prev, ...data.links])
        setNextCursor(data.nextCursor)
        updateAvailableCategories(data.links)
      }
    } catch (err) {
      console.error('Error loading more:', err)
    } finally {
      setLoading(false)
    }
  }

  // Parse hostname/domain for cards
  const getDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace('www.', '')
    } catch {
      return urlStr
    }
  }

  // Format dates in consistent UPPERCASE mono text
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase()
    } catch {
      return dateStr
    }
  }

  // Dynamic Muted Color Styling for Category Badges
  const getCategoryStyle = (cat: string | null) => {
    if (!cat) return 'text-mute border-hairline bg-canvas/30'
    const c = cat.toLowerCase()
    if (c.includes('tech') || c.includes('code') || c.includes('dev') || c.includes('software')) {
      return 'text-indigo-400 border-indigo-900/50 bg-indigo-950/20'
    }
    if (c.includes('design') || c.includes('ux') || c.includes('style') || c.includes('frontend')) {
      return 'text-rose-400 border-rose-900/50 bg-rose-950/20'
    }
    if (c.includes('ai') || c.includes('ml') || c.includes('learning') || c.includes('data')) {
      return 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20'
    }
    if (c.includes('biz') || c.includes('finance') || c.includes('corp') || c.includes('marketing')) {
      return 'text-sky-400 border-sky-900/50 bg-sky-950/20'
    }
    return 'text-body border-hairline bg-canvas-soft'
  }

  // Get active filters count
  const activeFiltersCount = currentCategories.length + (currentStatus ? 1 : 0)

  const allCategories = availableCategories

  // Skeleton Card Grid
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, idx) => (
        <div key={idx} className="rounded-md border border-hairline bg-canvas-soft p-6 space-y-4 animate-pulse min-h-[220px]">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-24 bg-hairline rounded-xs" />
            <div className="h-4.5 w-16 bg-hairline rounded-xs" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 w-11/12 bg-hairline rounded-xs" />
            <div className="h-4 w-2/3 bg-hairline rounded-xs" />
          </div>
          <div className="space-y-1.5 pt-2">
            <div className="h-3 w-full bg-hairline rounded-xs" />
            <div className="h-3 w-full bg-hairline rounded-xs" />
          </div>
          <div className="border-t border-hairline/30 pt-4 flex justify-between items-center mt-auto">
            <div className="h-3 w-16 bg-hairline rounded-xs" />
            <div className="h-3 w-16 bg-hairline rounded-xs" />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-8 w-full">
      {/* Submit Input Section (unchanged flow, styled with Warp tokens) */}
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
            className="flex-1 bg-canvas border border-hairline rounded-sm text-ink placeholder:text-mute px-4 py-2.5 text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-on-primary font-medium px-6 py-2.5 rounded-sm hover:bg-primary/95 focus:outline-hidden focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed font-sans text-sm tracking-wide shrink-0 transition-all cursor-pointer"
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

      {/* Tabs Layout: Curation Queue vs Archived */}
      <div className="flex border-b border-hairline/60 gap-6">
        <button
          onClick={() => updateQueryParams({ archived: null })}
          className={`pb-3 px-1 text-xs font-mono tracking-wider transition-all border-b-2 cursor-pointer ${
            !currentArchived
              ? 'border-primary text-ink font-semibold'
              : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          CURATION QUEUE
        </button>
        <button
          onClick={() => updateQueryParams({ archived: 'true' })}
          className={`pb-3 px-1 text-xs font-mono tracking-wider transition-all border-b-2 cursor-pointer ${
            currentArchived
              ? 'border-primary text-ink font-semibold'
              : 'border-transparent text-mute hover:text-ink'
          }`}
        >
          ARCHIVED FEED
        </button>
      </div>

      {/* Controls Bar: Search, Filters Panel Toggle, Sort Dropdown */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Search title, summary, or domain..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-canvas-soft border border-hairline rounded-sm text-ink placeholder:text-mute pl-10 pr-4 py-2 text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3.5 top-3 text-mute">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <div className="flex w-full sm:w-auto items-center justify-end gap-3 shrink-0">
          {/* Filters Toggle Button */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-2 border px-4 py-2 rounded-sm text-xs font-mono tracking-wide transition-all cursor-pointer ${
              filterOpen || activeFiltersCount > 0
                ? 'bg-canvas border-primary text-ink'
                : 'border-hairline text-mute hover:text-ink bg-canvas-soft/40'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
            </svg>
            <span>FILTERS {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={currentSort}
              onChange={(e) => updateQueryParams({ sort: e.target.value })}
              className="bg-canvas-soft border border-hairline text-ink rounded-sm text-xs font-mono tracking-wide px-3 py-2 pr-9 appearance-none focus:outline-hidden cursor-pointer"
            >
              <option value="newest">SORT: NEWEST</option>
              <option value="oldest">SORT: OLDEST</option>
              <option value="category">SORT: CATEGORY</option>
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 absolute right-3 top-3.5 text-mute pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Collapsible Filters Panel */}
      {filterOpen && (
        <div className="bg-canvas-soft border border-hairline rounded-md p-5 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Filters */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase text-body-strong tracking-wider">Status</h4>
              <div className="flex flex-wrap gap-2">
                {['ALL', 'READY', 'PROCESSING', 'PENDING', 'FAILED'].map((st) => {
                  const mappedVal = st === 'ALL' ? null : st === 'READY' ? 'DONE' : st
                  const isActive = currentStatus === mappedVal || (st === 'ALL' && !currentStatus)
                  return (
                    <button
                      key={st}
                      onClick={() => updateQueryParams({ status: mappedVal })}
                      className={`px-3 py-1 rounded-sm text-xs font-mono border transition-all cursor-pointer ${
                        isActive
                          ? 'border-primary bg-primary text-on-primary font-medium'
                          : 'border-hairline text-mute bg-canvas/30 hover:text-ink'
                      }`}
                    >
                      {st}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category Filters */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase text-body-strong tracking-wider">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((cat) => {
                  const isSelected = currentCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        const nextCats = isSelected
                          ? currentCategories.filter(c => c !== cat)
                          : [...currentCategories, cat]
                        updateQueryParams({ category: nextCats })
                      }}
                      className={`px-3 py-1 rounded-sm text-xs font-mono border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary text-on-primary font-medium'
                          : 'border-hairline text-mute bg-canvas/30 hover:text-ink'
                      }`}
                    >
                      {cat.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Reset Action */}
          {(currentCategories.length > 0 || currentStatus || searchInput) && (
            <div className="flex justify-end pt-3 border-t border-hairline/20">
              <button
                onClick={() => {
                  setSearchInput('')
                  router.push(pathname + (currentArchived ? '?archived=true' : ''))
                }}
                className="text-[10px] font-mono text-mute hover:text-ink transition-colors uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                RESET ALL FILTERS
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Section */}
      {loading && links.length === 0 ? (
        <SkeletonGrid />
      ) : links.length === 0 ? (
        /* Empty States */
        <div className="rounded-md border border-dashed border-hairline bg-canvas-soft/30 p-16 text-center space-y-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-mute mx-auto opacity-70">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          {currentSearch || currentStatus || currentCategories.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-base font-normal text-ink">No matching results</h3>
              <p className="text-xs text-mute max-w-sm mx-auto">
                No links match your current filters. Try adjusting your search term, toggling categories, or clear filters.
              </p>
              <button
                onClick={() => {
                  setSearchInput('')
                  router.push(pathname + (currentArchived ? '?archived=true' : ''))
                }}
                className="mt-2 text-xs font-mono text-ink border border-hairline hover:border-mute px-4 py-2 rounded-sm bg-canvas-soft/50 hover:bg-canvas-soft transition-all cursor-pointer"
              >
                CLEAR FILTER RULES
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-base font-normal text-ink">No links in {currentArchived ? 'archive' : 'queue'}</h3>
              <p className="text-xs text-mute max-w-sm mx-auto">
                {currentArchived 
                  ? 'Items you archive will appear here so you can clean up your inbox but keep them for reference.'
                  : 'Your inbox is empty. Submit a developer article or doc URL above to start curating!'
                }
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Card Grid Layout */
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link) => {
              const domain = getDomain(link.url)
              const hasFailure = link.status === 'FAILED'
              const isUnread = !link.readAt && link.status === 'DONE'

              return (
                <div
                  key={link.id}
                  className="rounded-md border border-hairline bg-canvas-soft p-6 flex flex-col justify-between min-h-[240px] transition-all hover:bg-canvas-soft/90 hover:border-mute/40"
                >
                  {/* Card Header: Domain, Badges, and Unread Dot */}
                  <div className="flex items-start justify-between gap-3 text-xs mb-3">
                    <span className="font-mono text-[10px] text-mute uppercase tracking-wider truncate max-w-[120px]" title={domain}>
                      {domain}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {link.category && (
                        <span className={`px-2 py-0.5 rounded-sm font-mono text-[9px] tracking-wider uppercase border ${getCategoryStyle(link.category)}`}>
                          {link.category}
                        </span>
                      )}
                      
                      {/* Read / Unread Indicator Dot */}
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary" title="Unread" />
                      )}

                      {/* Status Cues */}
                      {link.status === 'PENDING' && (
                        <span className="border border-dashed border-hairline text-mute bg-canvas/30 px-2 py-0.5 rounded-sm font-mono text-[9px] tracking-wider">
                          PENDING
                        </span>
                      )}
                      {link.status === 'PROCESSING' && (
                        <span className="border border-amber-900/50 text-amber-400 bg-amber-950/20 px-2 py-0.5 rounded-sm font-mono text-[9px] tracking-wider animate-pulse flex items-center gap-1">
                          PROCESSING
                        </span>
                      )}
                      {hasFailure && (
                        <span className="border border-red-950 text-red-400 bg-red-950/20 px-2 py-0.5 rounded-sm font-mono text-[9px] tracking-wider">
                          FAILED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content: Title and Summary */}
                  <div className="space-y-2 flex-1">
                    {link.status === 'DONE' ? (
                      <>
                        <h3 className="text-base font-normal text-ink leading-snug tracking-tight font-sans line-clamp-2">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:underline"
                          >
                            {link.title || 'Untitled Article'}
                          </a>
                        </h3>
                        {link.summary ? (
                          <p className="text-xs text-body leading-relaxed line-clamp-3">
                            {link.summary}
                          </p>
                        ) : link.cleanedText ? (
                          <p className="text-xs text-body leading-relaxed line-clamp-3">
                            {link.cleanedText}
                          </p>
                        ) : (
                          <p className="text-xs text-mute italic">No description parsed.</p>
                        )}
                      </>
                    ) : link.status === 'PENDING' ? (
                      <div className="space-y-1">
                        <h3 className="text-sm font-normal text-ink truncate max-w-xs">{link.url}</h3>
                        <p className="text-xs text-mute italic">Waiting in processing queue...</p>
                      </div>
                    ) : link.status === 'PROCESSING' ? (
                      <div className="space-y-1">
                        <h3 className="text-sm font-normal text-ink truncate max-w-xs">{link.url}</h3>
                        <p className="text-xs text-mute italic">Scraping content and extracting title...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h3 className="text-sm font-normal text-ink truncate max-w-xs">{link.url}</h3>
                        <div className="rounded-xs border border-red-950 bg-red-950/10 p-3">
                          <p className="text-[11px] text-red-400 font-mono uppercase tracking-wider font-semibold mb-0.5">Scrape Error</p>
                          <p className="text-[11px] text-body-strong leading-normal line-clamp-2">{link.failureReason || 'Safety check failed or page timeout.'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Metadata and Actions */}
                  <div className="border-t border-hairline/30 pt-4 mt-4 flex items-center justify-between text-[9px] font-mono text-mute shrink-0">
                    <div>
                      SAVED: {formatDate(link.createdAt)}
                    </div>

                    {confirmDeleteId === link.id ? (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <span className="text-red-400 font-semibold tracking-wider">SURE?</span>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="bg-red-950 border border-red-800 text-red-300 px-2 py-0.5 rounded-sm hover:bg-red-900 transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="bg-canvas border border-hairline text-mute px-2 py-0.5 rounded-sm hover:text-ink transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {/* Read Toggle */}
                        {link.status === 'DONE' && (
                          <button
                            onClick={() => handleToggleRead(link.id, !link.readAt)}
                            className="hover:text-ink transition-all cursor-pointer flex items-center gap-0.5"
                            title={link.readAt ? 'Mark unread' : 'Mark read'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                            <span>{link.readAt ? 'UNREAD' : 'READ'}</span>
                          </button>
                        )}

                        {/* Archive Toggle */}
                        <button
                          onClick={() => handleToggleArchive(link.id, !link.archived)}
                          className="hover:text-ink transition-all cursor-pointer flex items-center gap-0.5"
                          title={link.archived ? 'Send to queue' : 'Archive item'}
                        >
                          {link.archived ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 12 12m0 0 3 3m-3-3V21M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                              </svg>
                              <span>QUEUE</span>
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                              </svg>
                              <span>ARCHIVE</span>
                            </>
                          )}
                        </button>

                        {/* Delete Trigger */}
                        <button
                          onClick={() => setConfirmDeleteId(link.id)}
                          className="hover:text-red-400 transition-all cursor-pointer flex items-center gap-0.5"
                          title="Delete link"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          <span>DELETE</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load More Pagination Trigger */}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="bg-canvas-soft border border-hairline text-ink hover:border-mute transition-all px-8 py-2.5 rounded-sm font-mono text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && (
                  <svg className="animate-spin h-3.5 w-3.5 text-ink" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {loading ? 'LOADING...' : 'LOAD MORE'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

